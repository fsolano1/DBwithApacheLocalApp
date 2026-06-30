# 1. Definimos una función pura (no tiene efectos secundarios y su resultado solo depende de sus entradas)
obtener_saludo = lambda nombre: f"Hola Mundo Funcional, {nombre}"

# 2. Creamos una función de orden superior (presentador acepta otra función como argumento)
def presentador(funcion_logica, nombre_usuario):
    """
    Función que aplica una lógica (funcion_logica) a un dato (nombre_usuario) y maneja la impresión del resultado.
    Esto demuestra el principio de inyección de comportamiento.
    """
    # La lógica de "cómo saludar" se inyecta externamente (polimorfismo/inyección de dependencia)
    mensaje = funcion_logica(nombre_usuario)
    print(mensaje)

if __name__ == "__main__":
    # Ejecución: Inyectamos la función 'obtener_saludo' en 'presentador'.
    # Esto separa la estructura del control de flujo (presentador) de la lógica específica (obtener_saludo).
    presentador(obtener_saludo, "Alumno")