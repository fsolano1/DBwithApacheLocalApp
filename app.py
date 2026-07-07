import os
import time
import base64
import json
import random
from datetime import datetime
import pandas as pd
from fastapi import FastAPI, Request, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from transformers import pipeline
import kagglehub
import pymysql
import pymysql.cursors

# Configuración de Matplotlib no interactivo (Agg) para entornos multiproceso y subprocesos
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import io
import threading

# Lock de exclusión mutua para evitar colisiones de hilos en la generación de gráficos de Matplotlib
matplotlib_lock = threading.Lock()

app = FastAPI(title="API de Análisis de Sentimientos Local con Autenticación")

# Montamos la carpeta static para servir archivos CSS/JS y templates para las páginas
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

GOOGLE_CLIENT_ID = "791499194745-n01aq3drid4cf0cmt3d35iedj20aml5f.apps.googleusercontent.com"

# Cargamos el modelo globalmente para que solo se suba a memoria una vez
print("Cargando modelo local de análisis de sentimientos...")
clasificador = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

# Modelos de entrada Pydantic
class TweetInput(BaseModel):
    text: str

class NewSampleInput(BaseModel):
    tweet: str
    sentiment: str
    entity: str

class EditSampleInput(BaseModel):
    tweet: str
    sentiment: str

# Base de datos en memoria (se inicializa al arrancar la aplicación)
validation_records = []
current_limit = "20"

# --- SISTEMA DE AUTENTICACIÓN ---
def decode_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            # Agregar relleno para base64 si es necesario
            padding = len(payload_b64) % 4
            if padding:
                payload_b64 += "=" * (4 - padding)
            payload_json = base64.b64decode(payload_b64).decode('utf-8')
            return json.loads(payload_json)
    except Exception as e:
        print("Error decoding token in backend:", e)
    return None

def verify_authentication(authorization: str = Header(None)):
    user_info = decode_token(authorization)
    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="No autorizado: Token de autenticación inválido o ausente. Inicie sesión en la esquina superior derecha."
        )
    return user_info

# --- GESTIÓN DE LA BASE DE DATOS Y CONEXIÓN A MYSQL ---
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "db_sentimientos")

def get_db_connection():
    try:
        if DB_PASSWORD:
            return pymysql.connect(
                host=DB_HOST,
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                cursorclass=pymysql.cursors.DictCursor
            )
        else:
            return pymysql.connect(
                host=DB_HOST,
                user=DB_USER,
                database=DB_NAME,
                cursorclass=pymysql.cursors.DictCursor
            )
    except Exception as e:
        print("Database connection error:", e)
        raise HTTPException(
            status_code=503,
            detail="conexión no válida, revisa tu conexión a tu db"
        )

@app.get("/api/db-status")
def get_db_status():
    """Verifica si la base de datos MySQL está en línea de forma pública."""
    try:
        connection = get_db_connection()
        connection.close()
        return {"status": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail="conexión no válida, revisa tu conexión a tu db"
        )

def get_all_records_for_charts():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction, confidence FROM tweets")
            rows = cursor.fetchall()
    except Exception as e:
        print("Error al obtener registros para gráficos desde MySQL:", e)
        return []
    finally:
        connection.close()
        
    records = []
    for row in rows:
        pred = row['sentiment_prediction'] if row['sentiment_prediction'] else "N/A"
        conf = float(row['confidence']) if row['confidence'] is not None else 0.0
        
        is_correct = False
        actual = row['sentiment_real']
        if actual.upper() == pred.upper():
            is_correct = True
        elif actual.lower() == "positive" and pred == "POSITIVE":
            is_correct = True
        elif actual.lower() == "negative" and pred == "NEGATIVE":
            is_correct = True
            
        records.append({
            "id": row['id_tweet'],
            "entity": row['entity'],
            "sentiment": row['sentiment_real'],
            "tweet": row['tweet_text'],
            "prediction": pred,
            "confidence": conf,
            "correct": is_correct,
            "latency_ms": 45.0 if pred != "N/A" else 0.0  # Latencia mockeada para consistencia visual en el timeline
        })
    return records

@app.on_event("startup")
def startup_event():
    print("Iniciando aplicación. Verificando conexión a base de datos MySQL...")
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as total FROM tweets")
            res = cursor.fetchone()
            print(f"Conexión exitosa a MySQL. Registros encontrados en la tabla 'tweets': {res['total']}")
        connection.close()
    except Exception as e:
        print("\n" + "="*80)
        print("ADVERTENCIA: No se pudo conectar a la base de datos MySQL en startup.")
        print(f"Detalle del error: {e}")
        print("Asegúrate de iniciar el servidor de MySQL y configurar las credenciales correctas.")
        print("="*80 + "\n")


# --- RUTAS DE LA APLICACIÓN ---

# 1. Ruta de inicio para cargar el frontend
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"google_client_id": GOOGLE_CLIENT_ID}
    )

# 2. Mantener compatibilidad con la interfaz de prueba de api.py original
@app.get("/api/saludo")
def api_saludo():
    return {
        "mensaje": "Hola Mundo",
        "timestamp": datetime.now().isoformat(),
        "status": "success",
        "autenticacion": "Google Identity Services (Nativo) - Migrado a FastAPI"
    }

# 3. Endpoint de clasificación de sentimiento individual (Autenticado)
@app.post("/api/predict")
def analizar_texto(input_data: TweetInput, user_info: dict = Depends(verify_authentication)):
    start_time = time.time()
    prediction = clasificador(input_data.text[:512])[0]
    latency_ms = round((time.time() - start_time) * 1000, 2)
    return {
        "text": input_data.text,
        "sentiment": prediction['label'],
        "confidence": round(prediction['score'], 4),
        "latency_ms": latency_ms
    }

# 4. Endpoint de obtención de los datos del dataset y métricas (Autenticado)
@app.get("/api/validation-results")
def get_validation_results(limit: str = None, user_info: dict = Depends(verify_authentication)):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Consultar total de registros en la base de datos
            cursor.execute("SELECT COUNT(*) as total FROM tweets")
            total_db_records = cursor.fetchone()['total']

            # Consultar con o sin límite
            if limit and limit != "all":
                try:
                    val_limit = int(limit)
                    cursor.execute("SELECT id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction, confidence FROM tweets ORDER BY RAND() LIMIT %s", (val_limit,))
                except ValueError:
                    cursor.execute("SELECT id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction, confidence FROM tweets ORDER BY RAND() LIMIT 20")
            else:
                cursor.execute("SELECT id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction, confidence FROM tweets ORDER BY RAND()")
            
            rows = cursor.fetchall()
    except Exception as e:
        print("Error consultando MySQL:", e)
        raise HTTPException(status_code=500, detail=f"Error al consultar la base de datos MySQL: {str(e)}")
    finally:
        connection.close()

    records = []
    correct_count = 0
    
    for row in rows:
        pred = row['sentiment_prediction'] if row['sentiment_prediction'] else "N/A"
        conf = float(row['confidence']) if row['confidence'] is not None else 0.0
        
        # Lógica de comparación de sentimientos
        is_correct = False
        actual = row['sentiment_real']
        if actual.upper() == pred.upper():
            is_correct = True
        elif actual.lower() == "positive" and pred == "POSITIVE":
            is_correct = True
        elif actual.lower() == "negative" and pred == "NEGATIVE":
            is_correct = True
            
        if is_correct and pred != "N/A":
            correct_count += 1
            
        records.append({
            "id": row['id_tweet'],
            "entity": row['entity'],
            "sentiment": row['sentiment_real'],
            "tweet": row['tweet_text'],
            "prediction": pred,
            "confidence": conf,
            "correct": is_correct,
            "latency_ms": round(random.uniform(35.0, 65.0), 1) if pred != "N/A" else 0.0  # Latencia mockeada para visualización
        })
        
    total_samples = len(records)
    accuracy = round(correct_count / total_samples, 4) if total_samples > 0 else 0
    avg_confidence = round(sum(r['confidence'] for r in records) / total_samples, 4) if total_samples > 0 else 0
    avg_latency = round(sum(r['latency_ms'] for r in records) / total_samples, 2) if total_samples > 0 else 0

    # Contar distribución original
    original_dist = {}
    for r in records:
        original_dist[r['sentiment']] = original_dist.get(r['sentiment'], 0) + 1

    # Contar distribución de predicciones
    pred_dist = {"POSITIVE": 0, "NEGATIVE": 0}
    for r in records:
        pred_label = r['prediction']
        if pred_label in pred_dist:
            pred_dist[pred_label] += 1
        else:
            pred_dist[pred_label] = 1

    return {
        "records": records,
        "metrics": {
            "total_samples": total_samples,
            "correct_count": correct_count,
            "accuracy": accuracy,
            "avg_confidence": avg_confidence,
            "avg_latency_ms": avg_latency,
            "total_db_records": total_db_records
        },
        "distributions": {
            "original": original_dist,
            "predicted": pred_dist
        }
    }

# 5. Agregar un nuevo tweet de validación (Autenticado)
@app.post("/api/validation-results")
def add_validation_sample(input_data: NewSampleInput, user_info: dict = Depends(verify_authentication)):
    # Evaluar inmediatamente el sentimiento del nuevo tweet
    start_time = time.time()
    res = clasificador(input_data.tweet[:512])[0]
    latency = (time.time() - start_time) * 1000

    pred = res['label']
    conf = round(res['score'], 4)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Buscar el siguiente ID único
            cursor.execute("SELECT MAX(id_tweet) as max_id FROM tweets")
            max_row = cursor.fetchone()
            next_id = (max_row['max_id'] + 1) if (max_row and max_row['max_id'] is not None) else 1000
            
            sql_insert = """
                INSERT INTO tweets (id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction, confidence)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql_insert, (next_id, input_data.entity, input_data.sentiment, input_data.tweet, pred, conf))
            connection.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al insertar el tweet en la base de datos MySQL: {str(e)}")
    finally:
        connection.close()

    # Determinar si es correcto
    is_correct = False
    actual = input_data.sentiment
    if actual.upper() == pred.upper():
        is_correct = True
    elif actual.lower() == "positive" and pred == "POSITIVE":
        is_correct = True
    elif actual.lower() == "negative" and pred == "NEGATIVE":
        is_correct = True

    return {
        "status": "success",
        "record": {
            "id": next_id,
            "entity": input_data.entity,
            "sentiment": input_data.sentiment,
            "tweet": input_data.tweet,
            "prediction": pred,
            "confidence": conf,
            "correct": is_correct,
            "latency_ms": round(latency, 2)
        }
    }

# 6. Editar un tweet existente (Autenticado)
@app.put("/api/validation-results/{row_id}")
def edit_validation_sample(row_id: int, input_data: EditSampleInput, user_info: dict = Depends(verify_authentication)):
    # Re-evaluar de forma individual
    start_time = time.time()
    res = clasificador(input_data.tweet[:512])[0]
    latency = (time.time() - start_time) * 1000

    pred = res['label']
    conf = round(res['score'], 4)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_tweet, entity FROM tweets WHERE id_tweet = %s", (row_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Registro de tweet no encontrado.")
            
            entity = row['entity']
            
            sql_update = """
                UPDATE tweets
                SET tweet_text = %s, sentiment_real = %s, sentiment_prediction = %s, confidence = %s
                WHERE id_tweet = %s
            """
            cursor.execute(sql_update, (input_data.tweet, input_data.sentiment, pred, conf, row_id))
            connection.commit()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al actualizar el tweet en la base de datos MySQL: {str(e)}")
    finally:
        connection.close()

    # Determinar si es correcto
    is_correct = False
    actual = input_data.sentiment
    if actual.upper() == pred.upper():
        is_correct = True
    elif actual.lower() == "positive" and pred == "POSITIVE":
        is_correct = True
    elif actual.lower() == "negative" and pred == "NEGATIVE":
        is_correct = True

    return {
        "status": "success",
        "record": {
            "id": row_id,
            "entity": entity,
            "sentiment": input_data.sentiment,
            "tweet": input_data.tweet,
            "prediction": pred,
            "confidence": conf,
            "correct": is_correct,
            "latency_ms": round(latency, 2)
        }
    }

# 7. Eliminar un tweet existente (Autenticado)
@app.delete("/api/validation-results/{row_id}")
def delete_validation_sample(row_id: int, user_info: dict = Depends(verify_authentication)):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_tweet FROM tweets WHERE id_tweet = %s", (row_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Registro de tweet no encontrado.")
            
            cursor.execute("DELETE FROM tweets WHERE id_tweet = %s", (row_id,))
            connection.commit()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error al eliminar el tweet de la base de datos MySQL: {str(e)}")
    finally:
        connection.close()
    return {"status": "success"}

# 8. Re-ejecutar inferencia global (Autenticado)
@app.post("/api/validation-results/re-run")
def rerun_validation(user_info: dict = Depends(verify_authentication)):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_tweet, tweet_text FROM tweets")
            rows = cursor.fetchall()
            
            for row in rows:
                res = clasificador(row['tweet_text'][:512])[0]
                pred = res['label']
                conf = round(res['score'], 4)
                
                cursor.execute(
                    "UPDATE tweets SET sentiment_prediction = %s, confidence = %s WHERE id_tweet = %s",
                    (pred, conf, row['id_tweet'])
                )
            connection.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la re-ejecución de inferencia sobre MySQL: {str(e)}")
    finally:
        connection.close()
        
    return get_validation_results(user_info=user_info)

# 9. Endpoint de distribución de dataset con Matplotlib (Autenticado)
@app.get("/api/charts/distribution")
def get_distribution_chart(user_info: dict = Depends(verify_authentication)):
    records = get_all_records_for_charts()
    
    with matplotlib_lock:
        try:
            original_labels = [r['sentiment'] for r in records]
            predicted_labels = [r['prediction'] for r in records]
            
            sns.set_theme(style="darkgrid")
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.5))
            
            # Gráfico de distribución original
            df_orig = pd.DataFrame({"Sentiment": original_labels})
            sns.countplot(data=df_orig, x="Sentiment", hue="Sentiment", ax=ax1, palette="viridis", order=sorted(list(set(original_labels))), legend=False)
            ax1.set_title("Ground Truth Sentiment Distribution", fontsize=11, fontweight='bold', pad=10)
            ax1.set_xlabel("Sentiment", fontsize=9)
            ax1.set_ylabel("Count", fontsize=9)
            ax1.tick_params(axis='x', rotation=15)
            
            # Gráfico de distribución de predicciones
            df_pred = pd.DataFrame({"Sentiment": predicted_labels})
            sns.countplot(data=df_pred, x="Sentiment", hue="Sentiment", ax=ax2, palette="magma", order=sorted(list(set(predicted_labels))), legend=False)
            ax2.set_title("Predicted Sentiment Distribution", fontsize=11, fontweight='bold', pad=10)
            ax2.set_xlabel("Predicted Sentiment", fontsize=9)
            ax2.set_ylabel("Count", fontsize=9)
            
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format="png", dpi=150)
            buf.seek(0)
            plt.close(fig)
            return StreamingResponse(buf, media_type="image/png")
        except Exception as e:
            plt.close()
            print("Error generating distribution chart:", e)
            raise HTTPException(status_code=500, detail=f"Error generating distribution chart: {str(e)}")

# 10. Endpoint de matriz de confusión (heatmaps) de sentimientos (Autenticado)
@app.get("/api/charts/confusion-matrix")
def get_confusion_matrix_chart(user_info: dict = Depends(verify_authentication)):
    records = get_all_records_for_charts()
        
    with matplotlib_lock:
        try:
            actual = [r['sentiment'] for r in records]
            predicted = [r['prediction'] for r in records]
            
            df = pd.DataFrame({"Actual": actual, "Predicted": predicted})
            cross_tab = pd.crosstab(df["Actual"], df["Predicted"])
            
            sns.set_theme(style="white")
            fig, ax = plt.subplots(figsize=(6, 5))
            
            # Dibujar mapa de calor (heatmap)
            sns.heatmap(cross_tab, annot=True, fmt="d", cmap="Blues", cbar=True, ax=ax, 
                        linewidths=.5, annot_kws={"size": 11, "weight": "bold"})
            
            ax.set_title("Sentiment Alignment Matrix\n(Actual vs. Predicted)", fontsize=11, fontweight='bold', pad=15)
            ax.set_xlabel("Predicted Sentiment (Model)", fontsize=9, labelpad=8)
            ax.set_ylabel("Ground Truth Sentiment (Dataset)", fontsize=9, labelpad=8)
            
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format="png", dpi=150)
            buf.seek(0)
            plt.close(fig)
            return StreamingResponse(buf, media_type="image/png")
        except Exception as e:
            plt.close()
            print("Error generating confusion matrix chart:", e)
            raise HTTPException(status_code=500, detail=f"Error generating confusion matrix: {str(e)}")

# 11. Endpoint de gráfico de correlación de Confianza vs Latencia (Autenticado)
@app.get("/api/charts/correlation")
def get_correlation_chart(user_info: dict = Depends(verify_authentication)):
    records = get_all_records_for_charts()
        
    with matplotlib_lock:
        try:
            confidences = [r['confidence'] for r in records]
            latencies = [r['latency_ms'] for r in records]
            correctness = ["Correct" if r['correct'] else "Incorrect" for r in records]
            
            df = pd.DataFrame({
                "Confidence": confidences,
                "Latency (ms)": latencies,
                "Result": correctness
            })
            
            sns.set_theme(style="darkgrid")
            fig, ax = plt.subplots(figsize=(6, 5))
            
            sns.scatterplot(
                data=df, 
                x="Confidence", 
                y="Latency (ms)", 
                hue="Result", 
                style="Result",
                palette={"Correct": "#2e7d32", "Incorrect": "#d32f2f"},
                alpha=0.8,
                s=80,
                ax=ax
            )
            
            if len(df) > 1:
                try:
                    sns.regplot(
                        data=df, 
                        x="Confidence", 
                        y="Latency (ms)", 
                        scatter=False, 
                        ax=ax, 
                        color="gray", 
                        line_kws={"linestyle": "--", "alpha": 0.5}
                    )
                except Exception:
                    pass
            
            ax.set_title("Confidence vs. Inference Latency", fontsize=11, fontweight='bold', pad=15)
            ax.set_xlabel("Model Confidence Score", fontsize=9)
            ax.set_ylabel("Inference Latency (ms)", fontsize=9)
            ax.legend(title="Inference Result", loc="best")
            
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format="png", dpi=150)
            buf.seek(0)
            plt.close(fig)
            return StreamingResponse(buf, media_type="image/png")
        except Exception as e:
            plt.close()
            print("Error generating correlation chart:", e)
            raise HTTPException(status_code=500, detail=f"Error generating correlation chart: {str(e)}")

# --- RUTAS REQUERIDAS POR EL BACKEND DE LA TAREA (COMPATIBILIDAD) ---
class PredictRequest(BaseModel):
    id_tweet: int

@app.get("/tweets")
def obtener_tweets():
    """Retorna los primeros 20 tweets almacenados en la base de datos para visualizarlos en el Front de la tarea."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id_tweet, entity, sentiment_real, tweet_text, sentiment_prediction FROM tweets LIMIT 20")
            resultado = cursor.fetchall()
            return resultado
    finally:
        connection.close()

@app.post("/predict-db")
def analizar_y_guardar_tweet(request: PredictRequest):
    """Obtiene un tweet específico por ID de MySQL, lo analiza con el LLM local y guarda la predicción en la BD."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # 1. Buscar el tweet en MySQL
            cursor.execute("SELECT tweet_text FROM tweets WHERE id_tweet = %s", (request.id_tweet,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Tweet no encontrado en la base de datos.")
            
            texto = row['tweet_text']
            
            # 2. Inferencia local con el modelo
            prediction = clasificador(texto[:512])[0]
            label_pred = prediction['label']
            confidence_pred = round(prediction['score'], 4)
            
            # 3. Persistir el resultado en la base de datos
            sql_update = """
                UPDATE tweets 
                SET sentiment_prediction = %s, confidence = %s 
                WHERE id_tweet = %s
            """
            cursor.execute(sql_update, (label_pred, confidence_pred, request.id_tweet))
            connection.commit()
            
            return {
                "id_tweet": request.id_tweet,
                "text": texto,
                "sentiment_llm": label_pred,
                "confidence": confidence_pred,
                "status": "Actualizado en Base de Datos"
            }
    finally:
        connection.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
