from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="API de Análisis de Sentimientos Local")

# Cargamos el modelo globalmente para que solo se suba a memoria una vez
clasificador = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

class TweetInput(BaseModel):
    text: str

@app.post("/predict")
def analizar_texto(input_data: TweetInput):
    prediction = clasificador(input_data.text[:512])[0]
    return {
        "text": input_data.text,
        "sentiment": prediction['label'],
        "confidence": round(prediction['score'], 4)
    }
