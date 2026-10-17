# Recuperación de errores al abrir campañas remotas

Una sesión y una campaña recordadas pueden omitir los formularios de acceso y
selección. Si falla la carga inicial, la pantalla de recuperación muestra la
cuenta, la campaña y el detalle original del error. Sus controles permanecen
fuera del contenedor que reemplaza el manejador general de errores de inicio.

- **Reintentar** recarga conservando la selección.
- **Cambiar campaña** elimina únicamente la preferencia del selector y recarga.
- **Cerrar sesión** cierra la sesión actual del dispositivo; después elimina la
  preferencia del selector y recarga. Un error al cerrar sesión se muestra y
  permite reintentar.

La carga remota fallida sigue rechazándose: no se habilita una campaña vacía ni
se escribe una copia local sobre el estado remoto. Las validaciones de personaje
incluyen su nombre, ID y hasta cinco campos inválidos, conservando el error
original en `cause`. Los errores de reconstrucción no prueban por sí mismos una
caída de Supabase ni corrupción de los datos: también pueden ser excepciones del
cliente.

Para diagnosticar, pedir el contenido de **Detalle del error**, la versión del
Symbiote y la campaña que muestra la pantalla. Corregir únicamente el problema
identificado; reinstalar o borrar almacenamiento no es un paso de recuperación.

Validación: pruebas del repositorio y de recuperación de inicio comprueban el
rechazo de datos inválidos, la conservación de la causa, los controles tras un
fallo con campaña recordada y la preservación de otras claves locales.
