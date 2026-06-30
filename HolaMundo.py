# Aplicación básica: Hola Mundo
# Esta es la versión más simple de la aplicación, ejecutada por consola.

def obtener_saludo():
    """
    Retorna el saludo clásico de bienvenida.
    """
    return "Hola Mundo"

if __name__ == "__main__":
    # Imprime el saludo en la consola
    mensaje = obtener_saludo()
    print(mensaje)
