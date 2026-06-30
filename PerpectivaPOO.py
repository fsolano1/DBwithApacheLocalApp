# Perspectiva de Programación Orientada a Objetos (POO)

class SistemaSaludo:
    """
    Clase que encapsula la información del usuario y el comportamiento de saludarlo.
    Demuestra Encapsulación: los datos (usuario) y las operaciones (ejecutar_saludo)
    están agrupados en un solo objeto.
    """
    def __init__(self, nombre_usuario):
        # Inicializador: Define los atributos del objeto al crearse
        self.usuario = nombre_usuario  # Atributo del objeto (datos)

    def ejecutar_saludo(self):
        """
        Método que define el comportamiento del objeto.
        Esta es la acción que se realiza sobre los datos.
        """
        print(f"Hola Mundo desde POO para: {self.usuario}")

# 2. Instanciación: Creamos un objeto concreto
if __name__ == "__main__":
    # Creación del objeto (Instancia): 'mi_sistema' es una instancia de la clase SistemaSaludo
    mi_sistema = SistemaSaludo("Alumno de Python")

    # Ejecución del comportamiento a través del objeto
    mi_sistema.ejecutar_saludo()
