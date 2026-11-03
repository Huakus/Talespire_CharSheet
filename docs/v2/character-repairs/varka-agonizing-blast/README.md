# Varka: sustitución de invocación

Reparación autorizada por el usuario el 2026-11-02: sustituir Arma Mejorada del Pacto por Descarga agonizante. Como no se recuerda el nivel original, se registra como sustitución en el ascenso a nivel 10, conservando la selección de Arma Mejorada del Pacto en nivel 5.

Aplicada en ECE a la Varka activa, sin modificar la copia archivada. Se guardó en una transacción con bloqueo y comprobación de revisiones de campaña, personaje y cuatro fragmentos. No se tocaron los datos de `.localstorage/`.

- `before.json`: respaldo de los fragmentos originales y sus revisiones.
- `prepared.json`: cambios previstos y resultados de validación del dominio.
- `apply.sql`: operación aplicada; exige los valores y revisiones originales, por lo que repetirla después de la reparación se rechaza.
- `after.json`: lectura del servidor después de guardar.
- `verification.json`: comparación de la lectura con el plan; todos los fragmentos ajenos a la reparación permanecen idénticos.

Validado: cinco invocaciones activas, sustitución correcta, Estallido arcano `1d10+5` por impacto, retirada del +1 al arma de pacto, preservación de cargas/usos/PG/monedas/espacios/conjuros/inventario, y simulación válida de nivel 11 sin guardar ese ascenso. Los rasgos existentes que permanecen seleccionados conservan íntegramente su estado.

El script `scripts/prepare-varka-invocation-repair.mjs` reproduce la preparación usando el respaldo. No consulta ni modifica la base de datos. Esta carpeta contiene datos privados de la campaña y debe permanecer dentro del proyecto del usuario.
