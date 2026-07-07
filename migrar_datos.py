import os
import random
import pandas as pd
from sqlalchemy import create_engine, text
import kagglehub

# 1. Conexión a la base de datos MySQL (Ajusta usuario y contraseña usando variables de entorno o valores por defecto)
db_host = os.environ.get("DB_HOST", "localhost")
db_user = os.environ.get("DB_USER", "root")
db_password = os.environ.get("DB_PASSWORD", "")
db_name = os.environ.get("DB_NAME", "db_sentimientos")

if db_password:
    connection_uri = f"mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_name}"
else:
    connection_uri = f"mysql+pymysql://{db_user}@{db_host}/{db_name}"

print(f"Estableciendo conexión a la base de datos MySQL en: mysql+pymysql://{db_user}:****@{db_host}/{db_name}")
engine = create_engine(connection_uri)

# 2. Carga del Dataset de Kaggle
csv_filename = 'twitter_validation.csv'
columnas = ['id_tweet', 'entity', 'sentiment_real', 'tweet_text']

df_full = None
if not os.path.exists(csv_filename):
    print(f"El archivo '{csv_filename}' no se encuentra en el directorio raíz. Descargándolo de Kagglehub...")
    try:
        path = kagglehub.dataset_download("umersajid842/twitter-validation-csv")
        csv_path = os.path.join(path, "twitter_validation.csv")
        if not os.path.exists(csv_path):
            for root, dirs, files in os.walk(path):
                if "twitter_validation.csv" in files:
                    csv_path = os.path.join(root, "twitter_validation.csv")
                    break
        print(f"Cargando dataset desde la ruta de caché de Kagglehub: {csv_path}")
        df_full = pd.read_csv(csv_path, names=columnas)
    except Exception as e:
        print(f"Error al descargar o procesar el dataset desde Kagglehub: {e}")
else:
    print(f"Cargando dataset desde el archivo local: {csv_filename}")
    df_full = pd.read_csv(csv_filename, names=columnas)

df_val = None
if df_full is not None:
    # Limpiamos y aleatorizamos el dataset
    df_clean = df_full.dropna().drop_duplicates(subset=['id_tweet'])
    # Usamos el dataset completo
    df_val = df_clean
    print(f"Dataset cargado: Seleccionadas {len(df_val)} muestras (totalidad del dataset).")

# 3. Inserción de datos a la tabla de MySQL
if df_val is not None:
    try:
        # Limpiar datos existentes en MySQL para evitar errores de clave primaria duplicada
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE TABLE tweets"))
        print("Tabla 'tweets' truncada con éxito en MySQL.")
        
        # Insertar los registros en la tabla 'tweets'
        df_val.to_sql(name='tweets', con=engine, if_exists='append', index=False)
        print("¡Migración exitosa! Los datos completos de Kaggle ya están en MySQL.")
    except Exception as e:
        print(f"Error durante la migración: {e}")
else:
    print("Error: No se cargó ningún dataset válido para migrar.")
