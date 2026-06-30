import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
import pymysql
from fastapi.responses import HTMLResponse

app = FastAPI(title="API de Análisis de Sentimientos con MySQL")

# Configuración de conexión a MySQL (con soporte para variables de entorno y valores por defecto)
def get_db_connection():
    db_host = os.environ.get("DB_HOST", "localhost")
    db_user = os.environ.get("DB_USER", "root")
    db_password = os.environ.get("DB_PASSWORD", "password")
    db_name = os.environ.get("DB_NAME", "db_sentimientos")
    
    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        database=db_name,
        cursorclass=pymysql.cursors.DictCursor
    )

# Carga del modelo global en memoria
print("Cargando modelo local de análisis de sentimientos para main.py...")
clasificador = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

class PredictRequest(BaseModel):
    id_tweet: int

@app.get("/tweets")
def obtener_tweets():
    """Retorna los primeros 20 tweets almacenados en la base de datos para visualizarlos en el Front."""
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

@app.get("/", response_class=HTMLResponse)
def frontend():
    return """
    <html>
        <head>
            <title>Panel de Control de Sentimientos (MySQL)</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background-color: #f4f6f9; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
                th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #0056b3; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                button { background-color: #28a745; color: white; border: none; padding: 8px 12px; cursor: pointer; border-radius: 4px; }
                button:hover { background-color: #218838; }
            </style>
        </head>
        <body>
            <h2>Análisis de Sentimientos desde Base de Datos Local (MySQL)</h2>
            <p>A continuación se muestran los registros migrados de Kaggle. Presiona el botón para procesarlos con el LLM local:</p>
            
            <table>
                <thead>
                    <tr>
                        <th>ID Tweet</th>
                        <th>Entidad</th>
                        <th>Sentimiento Real (Kaggle)</th>
                        <th>Texto del Tweet</th>
                        <th>Predicción IA (MySQL)</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody id="tabla-tweets">
                    </tbody>
            </table>

            <script>
                async function cargarTweets() {
                    const response = await fetch('/tweets');
                    const tweets = await response.json();
                    const tbody = document.getElementById('tabla-tweets');
                    tbody.innerHTML = '';
                    
                    tweets.forEach(t => {
                        tbody.innerHTML += `
                            <tr>
                                <td>${t.id_tweet}</td>
                                <td>${t.entity}</td>
                                <td><strong>${t.sentiment_real}</strong></td>
                                <td>${t.tweet_text}</td>
                                <td id="pred-${t.id_tweet}">${t.sentiment_prediction ? t.sentiment_prediction : '<i>Sin procesar</i>'}</td>
                                <td><button onclick="procesarTweet(${t.id_tweet})">Analizar con LLM</button></td>
                            </tr>
                        `;
                    });
                }

                async function procesarTweet(id) {
                    const tdPred = document.getElementById(`pred-${id}`);
                    tdPred.innerText = "Procesando...";
                    
                    const response = await fetch('/predict-db', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({id_tweet: id})
                    });
                    
                    const data = await response.json();
                    if(response.ok) {
                        tdPred.innerHTML = `<strong>${data.sentiment_llm}</strong> (${data.confidence})`;
                    } else {
                        tdPred.innerText = "Error";
                    }
                }

                // Cargar datos al iniciar la página
                window.onload = cargarTweets;
            </script>
        </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    # Se ejecuta en el puerto 8000 para evitar conflictos con el app.py principal en el puerto 5000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
