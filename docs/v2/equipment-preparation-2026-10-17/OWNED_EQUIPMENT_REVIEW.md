Se revisó el lote de objetos que usan personajes y comerciantes de ECE: 241 posesiones y 24 entradas de stock. El resultado se guardó en preparación, en la revisión de campaña 1197. Las fichas, stock, catálogo activo, catálogo compartido y otras campañas conservaron sus checksums anteriores.

Se actualizaron 117 definiciones: 103 se cotejaron con las fuentes de reglas disponibles y las otras 14 se revisaron como reglas de campaña o contenido con limitaciones de fuente. Para las 54 posesiones sin correspondencia inicial, se reconocieron siete identidades ordinarias y se guardaron 47 variantes personales con sus originales completos. Nueve recuperaron además descripciones de la fuente original de campaña.

El catálogo de preparación tiene ahora 853 registros: 140 con texto revisado y 83 con identidad, texto y representación de reglas revisados. Esto no certifica la recuperación completa de campos ni una ejecución automática. Quedan 713 textos del conjunto general por revisar, además de los conflictos e integraciones señalados en cada objeto. No se eliminó ni migró ninguna versión.

Las definiciones revisadas están en [used-equipment-reviewed-definitions.json](used-equipment-reviewed-definitions.json). Las variantes están en [inventory-only-definitions.json](inventory-only-definitions.json) y la clasificación por posesión en [inventory-only-review.json](inventory-only-review.json). La [verificación del guardado](owned-review-verified.json) registra las cantidades, integridad y límites comprobados.

Fuentes principales: [SRD 5.1 español oficial](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1_ES.pdf), [SRD 5.1 inglés](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) y [Vicious Weapon de 2014](https://www.dndbeyond.com/magic-items/5399-vicious-weapon). Se incorporó el [reconocimiento de licencia](../SRD_5_1_ATTRIBUTION.md) tanto al panel como a los datos exportables que contienen material del SRD. Las referencias incluyen localización y condición editorial; las traducciones propias no se presentan como texto oficial español.

Correcciones de reglas destacadas:

- Anillo de almacenamiento: capacidad de cinco **niveles** de conjuro, sin recuperación diaria. Cargarlo no requiere sintonización; lanzar desde él sí. La concentración depende del conjuro almacenado. Se deben conservar las estadísticas del lanzador original y el contenido de cada copia, sin deducirlo de un contador antiguo.
- Bastón de marchitamiento: tres cargas, recuperación de 1d3 al amanecer; sintonización por brujo, clérigo o druida. Daño adicional 2d10 necrótico y salvación de Constitución CD 15 para las desventajas especificadas.
- Armas feroces/viciosas: se conserva la regla del manual de 2014, siete puntos adicionales con un 20 natural. El SRD ofrece 2d6; la diferencia queda documentada y no se sustituye silenciosamente.
- Lengua de fuego: acción adicional para encender/apagar; 2d6 de fuego adicionales solo con la hoja encendida, luz y condiciones de apagado conservadas.
- Perla de poder: un uso hasta el siguiente amanecer, con sintonización por lanzador; no recarga por descanso largo. Botas élficas sin sintonización. Amuleto de salud y Diadema de intelecto establecen un mínimo de 19, sin reducir una puntuación superior.
- Pociones: dosis, curación y rarezas diferenciadas, con la tabla completa. Munición: precio y peso por unidad separados del paquete vendido en el manual. Los precios propios de comerciantes permanecen intactos.
- Bolsa de contención replicada: se recuperó el texto español oficial completo, incluidos capacidad, peso, extracción, asfixia, rotura e interacción extradimensional. Se conserva por separado su procedencia de infusión.
- Daga del Umbral: Hoja Fásica restringida a Stix y al 20 natural; no se concede por compartir una referencia antigua. No se convierte automáticamente el antiguo ataque +3 en una bonificación mágica +3.

Excepciones investigadas que todavía requieren evidencia o integración:

- Amuleto de la sabiduría: no se acreditó identidad oficial; el campo WIS +1 contradice la explicación «todas las salvaciones». Se conservaron ambas versiones sin resolver el conflicto por suposición.
- Sombra del Segador: INT +1 solo aparece en un campo; «1/día» no define el momento de recuperación. Se conservaron también las condiciones, concentración y contrapartidas del texto.
- Capa con runas: el espacio adicional de nivel 1 está escrito, pero no su recuperación ni interacción con Magia del Pacto. No se inventa una recarga.
- Laúd de Doss: se conservaron la historia recuperada y la corrección vigente a poco común, sin +2 a ataques. El [artículo oficial de 2022](https://www.dndbeyond.com/posts/1186-bard-201-the-best-magic-items-for-bards) confirma requisitos generales y cuatro conjuros comunes; la página del objeto redirige al marketplace y no permitió cotejar toda la regla específica. No se completó esa lista usando un foro ni se convirtió la antigua carga única en usos compartidos.
- Capa de Muchos Estilos: texto completado a partir del PDF aportado, identificado como traducción revisada y con la limitación de cotejo público de la fuente de 2017.
- Bombas experimentales, Monóculo analítico, municiones especiales y otros objetos personales: la fuente de campaña aporta contexto pero no siempre procedimientos completos. Se recuperó lo disponible, sin asignarles las reglas de otro objeto solo por su nombre.

La automatización pendiente está declarada en cada capacidad. El formato nuevo necesita todavía adaptadores de efectos, recursos y contenido almacenado antes de utilizarse en inventarios o comercio. El orden acordado se mantiene: completar el conjunto y sus funciones, simular los cambios por copia, migrar usos y finalmente retirar versiones sin uso.

Validación de esta entrega: 84 pruebas pertinentes en nueve archivos, TypeScript y compilación mediante `npm run build:v2 -- --emptyOutDir=false`. El verificador carga los 853 registros con el almacén real de la aplicación, comprueba cero errores de preparación y vuelve a verificar 3237 originales únicos mediante SHA-256. Las 806 opciones españolas activas se mantienen y los borradores siguen cargándose solo al abrir su sección.
