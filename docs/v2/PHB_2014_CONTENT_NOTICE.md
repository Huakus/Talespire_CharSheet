# Fuentes y atribución del generador 2014

El aviso distribuido con la aplicación está en
[`phb-content-notice.txt`](../../src/domain/character/phb-content-notice.txt).
El tutorial lo muestra en **Identidad → Fuentes y créditos**; Vite lo incorpora
al JavaScript, también en el paquete de distribución.

Los catálogos `phb-srd-spells.json` y `phb-srd-equipment.json` derivan de las
[listas 2014 de 5e-bits/5e-database](https://github.com/5e-bits/5e-database/tree/main/src/2014/en).
Conservan textos SRD en inglés. La selección, normalización, metadatos de tirada,
tipos y etiquetas se adaptaron al modelo de ficha del proyecto. El aviso incluye
el copyright y la licencia MIT de la organización de esos datos.

El catálogo actual contiene 361 conjuros del PHB y 95 de Xanathar. La capa de
presentación en español utiliza los PDF aportados por el usuario, conservando
claves estables y las correcciones verificadas de reglas y listas de clase.
El archivo SRD original permanece como procedencia de metadatos; los textos
ingleses se sustituyen al presentar los conjuros.

El contenido SRD 5.1 utiliza la licencia CC BY 4.0. La atribución requerida está
incluida en el aviso distribuido. Véanse el
[SRD 5.1 oficial](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf)
y la [licencia CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

Los rasgos y dotes fuera del SRD usan resúmenes mecánicos propios. Los textos de
conjuros procedentes de los PDF tienen esa procedencia; las licencias MIT y SRD
no se atribuyen al contenido no SRD de los libros. No se distribuyen los PDF ni
sus ilustraciones. El PDF de Xanathar acredita una traducción de Alvaro1555 y
no se presenta como traducción editorial oficial.

El paquete usa las reglas del Manual del Jugador 2014 con sus
[erratas oficiales](https://media.wizards.com/2021/dnd/downloads/PH-Errata.pdf).
También incorpora Xanathar y sus
[erratas oficiales](https://media.wizards.com/2020/dnd/downloads/XGtE-Errata.pdf).
No utiliza reglas revisadas de 2024 ni opciones de Tasha. La cobertura actual,
las pruebas y las correcciones se documentan en
[Clérigo y Xanathar](CLERIC_XANATHAR_IMPLEMENTATION.md).
La revisión de Mago también usa el
[Sage Advice Compendium de 2014](https://www.dndbeyond.com/sources/dnd/sac/sage-advice-compendium),
incluida la preparación exigida para Cambiaformas.
