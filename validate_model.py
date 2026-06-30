import os
import pandas as pd
from transformers import pipeline
import kagglehub

# 1. Descargar base de datos desde Kagglehub
print("Descargando dataset desde Kaggle...")
path = kagglehub.dataset_download("umersajid842/twitter-validation-csv")
print("Ruta del dataset:", path)

# Localizar el archivo twitter_validation.csv en el directorio descargado
csv_path = os.path.join(path, "twitter_validation.csv")
if not os.path.exists(csv_path):
    for root, dirs, files in os.walk(path):
        if "twitter_validation.csv" in files:
            csv_path = os.path.join(root, "twitter_validation.csv")
            break

print("Cargando dataset desde:", csv_path)

# 2. Carga y preparación del Dataset
columnas = ['ID', 'Entity', 'Sentiment', 'Tweet']
df_val = pd.read_csv(csv_path, names=columnas).dropna().head(20)

# 3. Configuración del pipeline (Descarga inicial local)
print("\nCargando clasificador de sentimientos (distilbert-base-uncased-finetuned-sst-2-english)...")
clasificador_local = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

def predecir_sentimiento_local(texto):
    # Truncamos a 512 caracteres por seguridad
    resultado = clasificador_local(texto[:512]) 
    return resultado[0]['label']

# 4. Comparativa de etiquetas (Real vs Local)
print("Ejecutando predicciones locales...")
df_val['Prediccion_Local'] = df_val['Tweet'].apply(predecir_sentimiento_local)

print("\n=== COMPARATIVA DE ETIQUETAS (Sentiment Real vs Predicción Local) ===")
print(df_val[['Sentiment', 'Prediccion_Local']])
print("====================================================================")
