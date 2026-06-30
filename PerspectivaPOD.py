# Perspectiva de Programación Orientada a Datos (DOP)

from dataclasses import dataclass

# 1. Definimos la estructura del dato (Data Class):
# Se define exactamente qué información es relevante para representar un "usuario" o un "contexto".
@dataclass
class ContextoSaludo:
    """
    Define la estructura de los datos necesarios para realizar una presentación.
    Los datos son la entidad principal.
    """
    nombre: str
    tipo_rol: str  # Usamos 'tipo_rol' en lugar de 'rol' para mantener la coherencia con el ejemplo.
    id_sesion: int

# 2. Función externa que procesa la estructura de datos (Lógica separada)
def imprimir_ficha(datos: ContextoSaludo):
    """
    Esta función se encarga únicamente de la presentación o manipulación del dato,
    separando la lógica de la estructura de los datos.
    """
    print(f"Hola Mundo Data-Oriented: {datos.nombre} | Tipo de Rol: {datos.tipo_rol}")

if __name__ == "__main__":
    # 3. Creación del dato (Instanciación): Creamos un objeto que contiene la información.
    contexto_actual = ContextoSaludo(nombre="Alumno", tipo_rol="Admin", id_sesion=101)

    # 4. Ejecución de la lógica: Pasamos el dato estructurado a una función para su procesamiento.
    imprimir_ficha(contexto_actual)
