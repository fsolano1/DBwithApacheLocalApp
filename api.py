# -*- coding: utf-8 -*-
"""
Aplicación APIficada: Hola Mundo API con Login de Google Nativo
Esta aplicación expone un saludo clásico de 'Hola Mundo' a través de una API REST.
También sirve una interfaz web moderna y estética para interactuar con la API.
"""

from flask import Flask, jsonify, render_template, request
from datetime import datetime
import base64
import json

app = Flask(__name__)

# REQUISITO MÍNIMO: Reemplaza esto con tu Client ID de Google Cloud.
# Lo obtienes creando una "Credencial de OAuth" en https://console.cloud.google.com/
GOOGLE_CLIENT_ID = "791499194745-n01aq3drid4cf0cmt3d35iedj20aml5f.apps.googleusercontent.com"

def decode_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            # Add padding if needed in base64 URL decoding
            padding = len(payload_b64) % 4
            if padding:
                payload_b64 += "=" * (4 - padding)
            payload_json = base64.b64decode(payload_b64).decode('utf-8')
            return json.loads(payload_json)
    except Exception as e:
        print("Error decoding token in backend:", e)
    return None

@app.route('/')
def home():
    # Renders the separate index.html template from templates/ directory
    return render_template('index.html', google_client_id=GOOGLE_CLIENT_ID)

@app.route('/api/saludo', methods=['GET'])
def api_saludo():
    """
    Ruta de la API REST que responde con un Hola Mundo en JSON,
    e incluye los detalles del usuario autenticado si se provee un token de portador (Bearer).
    """
    auth_header = request.headers.get("Authorization")
    user_info = decode_token(auth_header)
    
    response_data = {
        "mensaje": "Hola Mundo",
        "timestamp": datetime.now().isoformat(),
        "status": "success",
        "autenticacion": "Google Identity Services (Nativo)"
    }
    if user_info:
        response_data["usuario_autenticado"] = {
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "sub": user_info.get("sub")
        }
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)