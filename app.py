import os
import time
import base64
import json
from datetime import datetime
import pandas as pd
from fastapi import FastAPI, Request, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from transformers import pipeline
import kagglehub

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

# --- GESTIÓN DE LA BASE DE DATOS Y PIPELINE DE INFERENCIA ---
def get_validation_csv_path():
    try:
        path = kagglehub.dataset_download("umersajid842/twitter-validation-csv")
        csv_path = os.path.join(path, "twitter_validation.csv")
        if not os.path.exists(csv_path):
            for root, dirs, files in os.walk(path):
                if "twitter_validation.csv" in files:
                    csv_path = os.path.join(root, "twitter_validation.csv")
                    break
        return csv_path
    except Exception as e:
        print("Error al descargar el dataset desde Kagglehub:", e)
        return None

def run_records_inference():
    global validation_records
    print(f"Ejecutando inferencia sobre {len(validation_records)} registros en memoria...")
    for r in validation_records:
        start_time = time.time()
        res = clasificador(r['tweet'][:512])[0]
        latency = (time.time() - start_time) * 1000

        r['prediction'] = res['label']
        r['confidence'] = round(res['score'], 4)
        r['latency_ms'] = round(latency, 2)

        # Lógica de comparación de sentimientos
        is_correct = False
        actual_sentiment = r['sentiment']
        pred_sentiment = r['prediction']
        if actual_sentiment.upper() == pred_sentiment.upper():
            is_correct = True
        elif actual_sentiment.lower() == "positive" and pred_sentiment == "POSITIVE":
            is_correct = True
        elif actual_sentiment.lower() == "negative" and pred_sentiment == "NEGATIVE":
            is_correct = True
        r['correct'] = is_correct

def initialize_dataset(limit: str = "20"):
    global validation_records, current_limit
    current_limit = limit
    csv_path = get_validation_csv_path()
    if not csv_path or not os.path.exists(csv_path):
        print("Warning: No se encontró el dataset para inicializar la base de datos en memoria.")
        return

    print(f"Cargando y preparando base de datos en memoria con límite {limit}...")
    columnas = ['ID', 'Entity', 'Sentiment', 'Tweet']
    df_val = pd.read_csv(csv_path, names=columnas).dropna()
    if limit != "all":
        try:
            val_limit = int(limit)
            df_val = df_val.head(val_limit)
        except ValueError:
            df_val = df_val.head(20)

    validation_records = []
    for _, row in df_val.iterrows():
        validation_records.append({
            "id": int(row['ID']),
            "entity": str(row['Entity']),
            "sentiment": str(row['Sentiment']),
            "tweet": str(row['Tweet']),
            "prediction": "N/A",
            "confidence": 0.0,
            "correct": False,
            "latency_ms": 0.0
        })
    run_records_inference()

@app.on_event("startup")
def startup_event():
    initialize_dataset()


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
    global validation_records, current_limit
    if limit is None:
        limit = current_limit

    if not validation_records or limit != current_limit:
        initialize_dataset(limit)

    correct_count = sum(1 for r in validation_records if r['correct'])
    total_latency = sum(r['latency_ms'] for r in validation_records)
    total_samples = len(validation_records)

    accuracy = round(correct_count / total_samples, 4) if total_samples > 0 else 0
    avg_confidence = round(sum(r['confidence'] for r in validation_records) / total_samples, 4) if total_samples > 0 else 0
    avg_latency = round(total_latency / total_samples, 2) if total_samples > 0 else 0

    # Contar distribución original
    original_dist = {}
    for r in validation_records:
        original_dist[r['sentiment']] = original_dist.get(r['sentiment'], 0) + 1

    # Contar distribución de predicciones
    pred_dist = {"POSITIVE": 0, "NEGATIVE": 0}
    for r in validation_records:
        pred_label = r.get('prediction', 'N/A')
        if pred_label in pred_dist:
            pred_dist[pred_label] += 1
        else:
            pred_dist[pred_label] = 1

    return {
        "records": validation_records,
        "metrics": {
            "total_samples": total_samples,
            "correct_count": correct_count,
            "accuracy": accuracy,
            "avg_confidence": avg_confidence,
            "avg_latency_ms": avg_latency
        },
        "distributions": {
            "original": original_dist,
            "predicted": pred_dist
        }
    }

# 5. Agregar un nuevo tweet de validación (Autenticado)
@app.post("/api/validation-results")
def add_validation_sample(input_data: NewSampleInput, user_info: dict = Depends(verify_authentication)):
    global validation_records
    
    # Generar un ID único autoincremental
    existing_ids = [r['id'] for r in validation_records]
    next_id = max(existing_ids) + 1 if existing_ids else 1000

    new_record = {
        "id": next_id,
        "entity": input_data.entity,
        "sentiment": input_data.sentiment,
        "tweet": input_data.tweet,
        "prediction": "N/A",
        "confidence": 0.0,
        "correct": False,
        "latency_ms": 0.0
    }

    # Evaluar inmediatamente el sentimiento del nuevo tweet
    start_time = time.time()
    res = clasificador(new_record['tweet'][:512])[0]
    latency = (time.time() - start_time) * 1000

    new_record['prediction'] = res['label']
    new_record['confidence'] = round(res['score'], 4)
    new_record['latency_ms'] = round(latency, 2)

    # Determinar si es correcto
    is_correct = False
    actual = new_record['sentiment']
    pred = new_record['prediction']
    if actual.upper() == pred.upper():
        is_correct = True
    elif actual.lower() == "positive" and pred == "POSITIVE":
        is_correct = True
    elif actual.lower() == "negative" and pred == "NEGATIVE":
        is_correct = True
    new_record['correct'] = is_correct

    validation_records.append(new_record)
    return {"status": "success", "record": new_record}

# 6. Editar un tweet existente (Autenticado)
@app.put("/api/validation-results/{row_id}")
def edit_validation_sample(row_id: int, input_data: EditSampleInput, user_info: dict = Depends(verify_authentication)):
    global validation_records
    for r in validation_records:
        if r['id'] == row_id:
            r['tweet'] = input_data.tweet
            r['sentiment'] = input_data.sentiment

            # Re-evaluar de forma individual
            start_time = time.time()
            res = clasificador(r['tweet'][:512])[0]
            latency = (time.time() - start_time) * 1000

            r['prediction'] = res['label']
            r['confidence'] = round(res['score'], 4)
            r['latency_ms'] = round(latency, 2)

            # Determinar si es correcto
            is_correct = False
            actual = r['sentiment']
            pred = r['prediction']
            if actual.upper() == pred.upper():
                is_correct = True
            elif actual.lower() == "positive" and pred == "POSITIVE":
                is_correct = True
            elif actual.lower() == "negative" and pred == "NEGATIVE":
                is_correct = True
            r['correct'] = is_correct

            return {"status": "success", "record": r}
            
    raise HTTPException(status_code=404, detail="Registro de tweet no encontrado.")

# 7. Eliminar un tweet existente (Autenticado)
@app.delete("/api/validation-results/{row_id}")
def delete_validation_sample(row_id: int, user_info: dict = Depends(verify_authentication)):
    global validation_records
    for idx, r in enumerate(validation_records):
        if r['id'] == row_id:
            validation_records.pop(idx)
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Registro de tweet no encontrado.")

# 8. Re-ejecutar inferencia global (Autenticado)
@app.post("/api/validation-results/re-run")
def rerun_validation(user_info: dict = Depends(verify_authentication)):
    run_records_inference()
    return get_validation_results(user_info=user_info)

# 9. Endpoint de distribución de dataset con Matplotlib (Autenticado)
@app.get("/api/charts/distribution")
def get_distribution_chart(user_info: dict = Depends(verify_authentication)):
    global validation_records
    if not validation_records:
        initialize_dataset()
    
    with matplotlib_lock:
        try:
            original_labels = [r['sentiment'] for r in validation_records]
            predicted_labels = [r['prediction'] for r in validation_records]
            
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
    global validation_records
    if not validation_records:
        initialize_dataset()
        
    with matplotlib_lock:
        try:
            actual = [r['sentiment'] for r in validation_records]
            predicted = [r['prediction'] for r in validation_records]
            
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
    global validation_records
    if not validation_records:
        initialize_dataset()
        
    with matplotlib_lock:
        try:
            confidences = [r['confidence'] for r in validation_records]
            latencies = [r['latency_ms'] for r in validation_records]
            correctness = ["Correct" if r['correct'] else "Incorrect" for r in validation_records]
            
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
