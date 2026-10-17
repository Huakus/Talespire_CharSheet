# Reemplazo de conjuros old en ECE

**Estado final:** por pedido del usuario se retiró Púas plateadas de la ficha de Skitrixx "Stix Ernesto" Koboldtanz. Quedan 315 entradas aprendidas y ninguna usa una versión `old`. El catálogo conserva sus archivos históricos. El [inventario actual](SPELL_OLD_USAGE.md) registra la retirada y su comprobación.

**Actualización posterior:** el usuario confirmó que Levantar maldición de Varka es Quitar maldición. Se reemplazó esa entrada por `official:spell:es:2014:remove-curse`, manteniendo identificador, orden, preparación, efecto y demás datos personales. Se verificaron las 316 entradas y la huella de todos los fragmentos ajenos a este cambio. El total acumulado es de 274 reemplazos; solo sigue pendiente Púas plateadas de Skitrixx. Respaldo y resultado de este cambio adicional: `tmp/spell-replacement/varka-curse-before.json`, `varka-curse-apply.sql` y `varka-curse-after.json`. El resto de este documento registra la primera operación de 273 reemplazos.

Aplicado y verificado el 16 de octubre de 2026 por pedido del usuario.

Se actualizaron 273 entradas de conjuro de 10 personajes: 240 versiones antiguas tienen reemplazo confirmado. Se conservaron las 316 entradas aprendidas, sus identificadores, orden, preparación, efectos y datos de lanzamiento. Las definiciones reemplazadas ahora apuntan al contenido activo del Manual del Jugador o de Xanathar.

## Pendientes sin modificar

| Personaje | Conjuro | Motivo |
| --- | --- | --- |
| Skitrixx "Stix Ernesto" Koboldtanz | Púas plateadas | No hay equivalente en el catálogo activo. |
| Varka | Levantar maldición | No tenía definición guardada; falta confirmar si corresponde a Quitar maldición. |

## Reemplazos por personaje

| Personaje | Entradas actualizadas |
| --- | ---: |
| Adler | 92 |
| Arturo | 1 |
| Delerion | 52 |
| Delerion 2 | 12 |
| Draven Korr | 14 |
| Edrick Voss | 5 |
| Garrick Vhal | 10 |
| Maelion Vaelaris | 18 |
| Skitrixx "Stix Ernesto" Koboldtanz | 10 |
| Varka | 59 |

## Validación

- Las 316 cargas guardadas coinciden con el resultado previsto: 273 actualizadas y 43 intactas.
- La interfaz resuelve 271 entradas del Manual del Jugador, 38 de Xanathar, 5 custom y 2 old.
- Se incrementaron las revisiones de los 273 fragmentos afectados, de sus 10 personajes y de ECE para respetar el control de cambios concurrentes.
- Los campos personales permanecen exactamente iguales.
- Los demás fragmentos de ECE y los fragmentos y catálogos de las otras campañas conservan sus huellas.
- Se ensayó la transacción completa con reversión antes de aplicar; luego se validaron los datos reales exportados mediante los adaptadores y el resolutor de interfaz.
- No se borraron registros del catálogo: permanecen los 242 archivos old, de los que 240 ya no se usan en ECE.
- No se modificaron .localstorage/, Toolset ni la aplicación distribuida.

## Casos revisados

- Mal de ojo de nivel 6 se vinculó a Eyebite; no a Hex de nivel 1.
- Phantasmal Force de Skitrixx se reemplazó por Fuerza fantasmal de 2014.
- Los nombres ingleses y traducciones alternativas se vincularon mediante claves y alias revisados, comprobando el nivel y la clave de lanzamiento cuando existía.
- No se fusionaron ni eliminaron entradas duplicadas anteriores de las fichas.

## Respaldo

Los archivos privados de recuperación están en `tmp/spell-replacement/`: `backup-before.json.gz`, `plan.json`, `snapshot-before.json`, `snapshot-after.json`, `apply.sql`, `rollback.sql`, `checksums.json`, `actual-spells-after.json` y `verification.json`. Están fuera de Git y del paquete de distribución. La recuperación se detiene si alguna de las 273 entradas ha cambiado desde el reemplazo y mantiene las revisiones crecientes. No se ejecutó la recuperación.

Preparación: `scripts/prepare-old-spell-replacement.mjs`. Comprobación de exportación real: `scripts/verify-old-spell-replacement.mjs`. Estos scripts no tienen acceso de escritura a la base de datos.

## Detalle de reemplazos

### Adler

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Adivinación | Adivinación | 4 | manual_jugador | spl_6b5bc7a72d758a603331e911e311995f |
| Amanecer | Amanecer | 5 | xanathar | spl_41fce6d4413999379593569f074646ad |
| Arma espiritual | Arma espiritual | 2 | manual_jugador | spl_ab7d18519e8b5ba93d9ee51608e3b523 |
| Arma sagrada | Arma Sagrada | 5 | xanathar | spl_1b0d81e266c9ed2af5401bb22f2870d7 |
| Augurio | Augurio | 2 | manual_jugador | spl_2f42f5e9d010a698f5829f006f99e6df |
| Mejorar la Capacidad | Aumentar característica | 2 | manual_jugador | spl_22d9aea56d035a6d1158445c627c0ebb |
| Aumentar característica | Aumentar característica | 2 | manual_jugador | spl_56c4f61975d4088857d31307eb68ff3b |
| Ayuda | Auxilio divino | 2 | manual_jugador | spl_d26b87493b073a6fe161f9654396b14a |
| Bendición | Bendecir | 1 | manual_jugador | spl_007c25f407953a99b05aa505cfdb587e |
| Calmar emociones | Calmar emociones | 2 | manual_jugador | spl_f2df17e1324238a4aa91e19e7217dc94 |
| Caminar sobre el agua | Caminar sobre las aguas | 3 | manual_jugador | spl_0278033e83b4675a4f5ac43082dffcd8 |
| Ceguera/sordera | Ceguera/Sordera | 2 | manual_jugador | spl_abb759e44b0968ea96b4dd9d08b0a3da |
| Ceremonia | Ceremonia | 1 | xanathar | spl_8e9339ae3d288a9f5802cac6b197933c |
| Clarividencia | Clarividencia | 3 | manual_jugador | spl_d863bbfc600685a87115dbf6c1cd4626 |
| Comunión | Comunión | 5 | manual_jugador | spl_952096ea9d26bb64d3901be9ae950bd8 |
| Conocer las leyendas | Conocimiento de leyendas | 5 | manual_jugador | spl_94ab7a03049f27490d6244e72b835b60 |
| Contagio | Contagio | 5 | manual_jugador | spl_060ec51cd0f332ef5ed9e120e956771c |
| Controlar agua | Controlar el agua | 4 | manual_jugador | spl_377a57eff8f16bfb36b8cb2e17759dd3 |
| Crear comida y agua | Crear comida y agua | 3 | manual_jugador | spl_a86350ca18f6d5c08140341519f90117 |
| Crear o destruir agua | Crear o destruir agua | 1 | manual_jugador | spl_e9080d52d6bc3dc46ce1372ae22e4b74 |
| Curar heridas | Curar heridas | 1 | manual_jugador | spl_e893d7d99197ad9745415a81dfd7ca54 |
| Curar heridas en masa | Curar heridas en masa | 5 | manual_jugador | spl_c58330347c7f69c9cfec5df994511589 |
| Custodia contra la muerte | Custodia contra la muerte | 4 | manual_jugador | spl_ca65fd89b95676e3f04f1832f5a0bb97 |
| Círculo mágico | Círculo mágico | 3 | manual_jugador | spl_729be6a2250a8ac3407b02126cab6ddb |
| Apacible descanso | Descanso apacible | 2 | manual_jugador | spl_61ade6b8d542a190d522c2c62cbe0376 |
| Golpe flamígero | Descarga flamígera | 5 | manual_jugador | spl_74d5d6905b0ca57d532a7cfb2a6e9f25 |
| Golpe de llamas | Descarga flamígera | 5 | manual_jugador | spl_ef8f40823d6594ece77d23361bf3a921 |
| Destierro | Destierro | 4 | manual_jugador | spl_307a7a5713fa861a5d3f1f320169e80f |
| Detectar el bien y el mal | Detectar el bien y el mal | 1 | manual_jugador | spl_2a06aa339632003e8222f1202a2114d2 |
| Detectar magia | Detectar magia | 1 | manual_jugador | spl_fc77eee47278c3e6f0d9718c32abcd74 |
| Detectar venenos y enfermedades | Detectar venenos y enfermedades | 1 | manual_jugador | spl_c620940bf7a4b6e9f385764889dd3a67 |
| Disipar el bien y el mal | Disipar el bien y el mal | 5 | manual_jugador | spl_e101b505c8ad86528335bea9ee7c1f72 |
| Disipar magia | Disipar magia | 3 | manual_jugador | spl_6b255b5355a16f96d8760bb58c2b8881 |
| Don de lenguas | Don de lenguas | 3 | manual_jugador | spl_f66590d92751e6c1f51b575fb292ce37 |
| Detectar trampas | Encontrar trampas | 2 | manual_jugador | spl_cc27d6f77e4a685dfcbb61ac9730b17a |
| Escudo de fe | Escudo de la fe | 1 | manual_jugador | spl_f628e9ff6bc742c7d960338fb070bb86 |
| Escudriñamiento | Escudriñamiento | 5 | manual_jugador | spl_b9a5722a78f4d919b4fcadf6b2e70f30 |
| Espíritus guardianes | Espíritus guardianes | 3 | manual_jugador | spl_fad13da18272c22d1c134c51893c85b4 |
| Faro de esperanza | Faro de esperanza | 3 | manual_jugador | spl_9dda870f1b3bc8ddfa98e592a630693d |
| Fingir muerte | Fingir muerte | 3 | manual_jugador | spl_cd1727b23769cfe6079598e3d83582a9 |
| Fundirse con la piedra | Fundirse con la piedra | 3 | manual_jugador | spl_563276a1d59341c49038e947796fb7c7 |
| Geas | Geas | 5 | manual_jugador | spl_d906e0fbd7d68afb5b012dcb5ec9fc42 |
| Glifo custodio | Glifo custodio | 3 | manual_jugador | spl_11e2e62db10fe273e3d3bf28ac1a3b72 |
| Guardián de la fe | Guardián de la fe | 4 | manual_jugador | spl_72625fbd0ccf610e486dbc301e60c78e |
| Hablar con los muertos | Hablar con los muertos | 3 | manual_jugador | spl_1dd4639c6aa91a56602c44db7a9f62e3 |
| Infligir heridas | Infligir heridas | 1 | manual_jugador | spl_2869f76ec656357dbb70089f84ec2db2 |
| Inmovilizar persona | Inmovilizar persona | 2 | manual_jugador | spl_4574a89f0cacc5677438b04e14053d6c |
| Imponer maldición | Lanzar maldición | 3 | manual_jugador | spl_51244757719b5ea4755cc7c364efab15 |
| Libertad de movimiento | Libertad de movimiento | 4 | manual_jugador | spl_dd66c2a8da63f91d70c6d836514a0670 |
| Atadura planar | Ligadura de los planos | 5 | manual_jugador | spl_f02b79f5fd892c8b4674efac75648ceb |
| Llama continua | Llama continua | 2 | manual_jugador | spl_26140b213e92c6c5284cf8cdef1a2e1e |
| Llama sagrada | Llama sagrada | 0 | manual_jugador | spl_23f0601d8ffbb1809cdcefe25fa7fabc |
| Localizar criatura | Localizar criatura | 4 | manual_jugador | spl_fb771bf741edb4cf5d68e75237fe3d1b |
| Localizar objeto | Localizar objeto | 2 | manual_jugador | spl_ebc9c9fe8f4176a697246258f6fbecc8 |
| Luz | Luz | 0 | manual_jugador | spl_b9c8220087502d55f5f7566040e2d8c8 |
| Luz del día | Luz del día | 3 | manual_jugador | spl_9877449eccfd6833d1c2f3f032e10348 |
| Plegaria de curación | Oración de curación | 2 | manual_jugador | spl_0f1f007ba7e615ff804d9dda88bc18f6 |
| Comando | Orden imperiosa | 1 | manual_jugador | spl_8e4214c2c9203f309c3a4133a33fbf6e |
| Orden imperiosa | Orden imperiosa | 1 | manual_jugador | spl_9deb9ab679ba82b4b73e1bd2670d54ee |
| Orientación divina | Orientación divina | 0 | manual_jugador | spl_f68030c39e9cb08b828a785ce49e2a23 |
| Palabra de resplandor | Palabra de Resplandor | 0 | xanathar | spl_4b25efe9968321a85d1378294e930d35 |
| Palabra de curación | Palabra sanadora | 1 | manual_jugador | spl_82a6c4c80978a00c24cefae7c4e86a2a |
| Palabra de curación en masa | Palabra sanadora de masas | 3 | manual_jugador | spl_3556f4714a1d9d2cd7560110dadb7869 |
| Perdición | Perdición | 1 | manual_jugador | spl_bd9ef63431bc6169fa4104627dcefa9a |
| Perdonar la vida | Perdonar la vida | 0 | manual_jugador | spl_cd675bdadbfde69011fada311435ab0d |
| Plaga de insectos | Plaga de insectos | 5 | manual_jugador | spl_b33517059e5937e3a0b2896853bb85a3 |
| Protección contra el bien y el mal | Protección contra el bien y el mal | 1 | manual_jugador | spl_11c310659f18c52a556fd47f96065688 |
| Protección contra veneno | Protección contra el veneno | 2 | manual_jugador | spl_0520e369be73d6be9185f5522b6edc8a |
| Protección contra energía | Protección contra la energía | 3 | manual_jugador | spl_c6d2090cefa920e9abf13e1be75a71ba |
| Purificar comida y bebida | Purificar comida y bebida | 1 | manual_jugador | spl_af67ed5ea2e470120bc9080e6fd71b16 |
| Quitar maldición | Quitar maldición | 3 | manual_jugador | spl_8b4b771aaad202cbbf9012b588228f79 |
| Saeta guiada | Rayo guiado | 1 | manual_jugador | spl_425f686189a14cebfffb1056e4825f34 |
| Animar a los muertos | Reanimar a los muertos | 3 | manual_jugador | spl_a22b1379f1dc6c167df1a03b792b5306 |
| Recado | Recado | 3 | manual_jugador | spl_86151c93078472a2017ad1004e0094a2 |
| Remendar | Remendar | 0 | manual_jugador | spl_22f6ba6ca2e88a3781a8612e7cf6bd24 |
| Resistencia | Resistencia | 0 | manual_jugador | spl_843d6cd7c612f4934545b1677a99f8ce |
| Restablecimiento mayor | Restablecimiento mayor | 5 | manual_jugador | spl_42f04497525fa5dece5923d4ae5f9d5e |
| Restablecimiento menor | Restablecimiento menor | 2 | manual_jugador | spl_c358a57d7678c2d689208387d2202d05 |
| Revivir | Revivir | 3 | manual_jugador | spl_7324d7283f38e0f3866a454c8803ff97 |
| Alzar a los muertos | Revivir a los muertos | 5 | manual_jugador | spl_246a91c813efaec21972cafea4b67fa5 |
| Revivir a los muertos | Revivir a los muertos | 5 | manual_jugador | spl_bb7478d94264a9b933194b22fe69ba0c |
| Santificar | Sacralizar | 5 | manual_jugador | spl_1d48decd34fca2c1407da99211ae5953 |
| Consagrar | Sacralizar | 5 | manual_jugador | spl_a19277798bf77a32d8d48a0371c854c0 |
| Santuario | Santuario | 1 | manual_jugador | spl_417f9e25072ddad87677966a551a006a |
| Silencio | Silencio | 2 | manual_jugador | spl_b99051436b71ea63073126be7ebce024 |
| Taumaturgia | Taumaturgia | 0 | manual_jugador | spl_ff17c1a4f62d2316d5f98250d3ad2359 |
| Llamar a los muertos | Tocar a los Muertos | 0 | xanathar | spl_5810ea4bc57da6a9b25f109fd6350bdf |
| Transferencia de vida | Transferencia de Vida | 3 | xanathar | spl_7bfb9ea317da15c7a3d7775943df25e4 |
| Moldear la piedra | Transformar piedra | 4 | manual_jugador | spl_88088f979cae7c5a71ae84f19088cfc8 |
| Transformar piedra | Transformar piedra | 4 | manual_jugador | spl_a342865e150747f0d4e2bfc1048fe434 |
| Vínculo protector | Vínculo protector | 2 | manual_jugador | spl_724bcd39ecd560b9c1d494580422ae9d |
| Zona de verdad | Zona de verdad | 2 | manual_jugador | spl_deb56c365c7ec5779c7e405d11147bdb |

### Arturo

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Zancada prodigiosa | Zancada prodigiosa | 1 | manual_jugador | spl_34c994d392c013f7b6d177f0dd7dad91 |

### Delerion

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Acelerar | Acelerar | 3 | manual_jugador | spl_38ffc07572075f8db4825a37448db5a6 |
| Alterar el propio aspecto | Alterar el propio aspecto | 2 | manual_jugador | spl_804aa306b8c4c2bd0fe363eb9976dd05 |
| Armadura de mago | Armadura de mago | 1 | manual_jugador | spl_ecdda798ff7478e9f72c11051b82afec |
| Aura mágica del arcano | Aura mágica de Nystul | 2 | manual_jugador | spl_a2b8036dca77c4d5665b742884a7b02e |
| Bola de fuego | Bola de fuego | 3 | manual_jugador | spl_c9a8b0dd6445ea587191797b2f981260 |
| Caída de pluma | Caída de pluma | 1 | manual_jugador | spl_b0ccda269d2178b3e2f119612e92b86a |
| Ceguera/sordera | Ceguera/Sordera | 2 | manual_jugador | spl_ededbb4c95c27d930e11734dcae0f71a |
| Clarividencia | Clarividencia | 3 | manual_jugador | spl_26c0ef7d4ae11b98977b71910145baa4 |
| Entender idiomas | Comprensión idiomática | 1 | manual_jugador | spl_920aa87afb707c69b07740ccb264163a |
| Contrahechizo | Contraconjuro | 3 | manual_jugador | spl_50045de96ef44dc597282f515110bea0 |
| Círculo de teletransportación | Círculo de teletransporte | 5 | manual_jugador | spl_caa86c177efd16dedca2289e49aa8dc7 |
| Danza macabra | Danza Macabra | 5 | xanathar | spl_48fa9237f154d8f47841fd2fe1440958 |
| Apacible descanso | Descanso apacible | 2 | manual_jugador | spl_96bda49c82c8e83e07b7b567216c5425 |
| Detectar pensamientos | Detectar pensamientos | 2 | manual_jugador | spl_03f477099b9d16a86a781358cb91ac01 |
| Dormir | Dormir | 1 | manual_jugador | spl_304408883e11bca1b057d1a54cca6955 |
| Encontrar familiar | Encontrar familiar | 1 | manual_jugador | spl_a11b28f5733752f898c8e5cc9dc43baf |
| Enemigos abundantes | Enemigos Abundantes | 3 | xanathar | spl_184df1275763ea0074a72322041b75b2 |
| Escudo | Escudo | 1 | manual_jugador | spl_4645c1856987c91b0ce4ff0f0b7ddfea |
| Esfera de llamas | Esfera flamígera | 2 | manual_jugador | spl_49fc5952ed5593ccdb3834c25007ae3b |
| Flecha ácida | Flecha ácida de Melf | 2 | manual_jugador | spl_3fc1b440ed98c6311bc678621c20dab8 |
| Grasa | Grasa | 1 | manual_jugador | spl_dd06ad8dd859174411ef98b3571be1de |
| Hablar con los muertos | Hablar con los muertos | 3 | manual_jugador | spl_4f0569da0cde1dec5358b76bcadd9236 |
| Hechizar persona | Hechizar persona | 1 | manual_jugador | spl_72549abe9a3bf1ee28215da5787cfcc1 |
| Imagen silenciosa | Imagen silenciosa | 1 | manual_jugador | spl_3b99570515cc1f25d8918543dfcd04fe |
| Impacto verdadero | Impacto verdadero | 0 | manual_jugador | spl_59af85f51def024e05e1ee7d9585e4d0 |
| Inundación de energía negativa | Inundación de Energía Negativa | 5 | xanathar | spl_b348a70688fe1205de50b3a980cf0844 |
| Invisibilidad | Invisibilidad | 2 | manual_jugador | spl_7c6d2a29c51d97531ff91b6bfd9e1654 |
| Imponer maldición | Lanzar maldición | 3 | manual_jugador | spl_1c1e8b193133d1fa4da9ef970af46505 |
| Levitar | Levitar | 2 | manual_jugador | spl_d825ff6bc1d64230572b59da1cccbb40 |
| Mano de mago | Mano de mago | 0 | manual_jugador | spl_64b4e548a505d267e820a78b1ddffb38 |
| Manos ardientes | Manos ardientes | 1 | manual_jugador | spl_373978f4e695fb0891ac7f8e6a821c10 |
| Marchitar | Marchitar | 4 | manual_jugador | spl_64d6f7bfb315b8c211dee1ad731a9bf0 |
| Meteoros diminutos de Melf | Meteoros Diminutos de Melf | 3 | xanathar | spl_ee218ce975ef87915e28fc44e2fdebda |
| Orbe cromatico | Orbe cromático | 1 | manual_jugador | spl_35a7e2c881fbbb1a87fa96709a2a1df5 |
| Paso brumoso | Paso brumoso | 2 | manual_jugador | spl_301d87d42bda00ed40768da5a984c873 |
| Proyectil mágico | Proyectil mágico | 1 | manual_jugador | spl_ffaed040ad33017ae6e82bc9a2d70bb6 |
| Rayo abrasador | Rayo abrasador | 2 | manual_jugador | spl_c28ba302692600d0d1f55b5c8a74bbd4 |
| Rayo debilitador | Rayo de debilitamiento | 2 | manual_jugador | spl_8b67034c1eee1fd5ccb65435db952c07 |
| Rayo de enfermedad | Rayo de dolencia | 1 | manual_jugador | spl_fd69460068ba265588b70f7f5eb06209 |
| Rayo de escarcha | Rayo de escarcha | 0 | manual_jugador | spl_f7f0d744f27205af4af8bad916557172 |
| Relámpago | Rayo relampagueante | 3 | manual_jugador | spl_f21ed9a3826fc168ca4628b064850894 |
| Animar a los muertos | Reanimar a los muertos | 3 | manual_jugador | spl_7c3f03565ab33d03c97cd3052504aa6d |
| Retirada expeditiva | Retirada expeditiva | 1 | manual_jugador | spl_164d070cfa18e69858af0b1b8ff99fb9 |
| Rociada de color | Rociada de color | 1 | manual_jugador | spl_76a7ce05d31c860a4561025e3421942c |
| Rociada venenosa | Rociada de veneno | 0 | manual_jugador | spl_7ba6dab980e816936a2c52ce9e61b8ee |
| Rayo de fuego | Saeta de fuego | 0 | manual_jugador | spl_801daeacd5b2d649ce4e1b772fb1e785 |
| Sirviente invisible | Sirviente invisible | 1 | manual_jugador | spl_83fa681c29da8ef43d20865ddff02736 |
| Telaraña | Telaraña | 2 | manual_jugador | spl_f63ca4598db570b2eaa46d1687b28d71 |
| Toque vampírico | Toque vampírico | 3 | manual_jugador | spl_7341690a7e7ee9e02d9a7ac1ad137690 |
| Transferencia de vida | Transferencia de Vida | 3 | xanathar | spl_dc8dada5ab33aa36ccfe74ec3e1b3b13 |
| Falsa vida | Vida falsa | 1 | manual_jugador | spl_fc56ebd2b2d186f9b48f6aca81955e73 |
| Volar | Volar | 3 | manual_jugador | spl_210c50a456d1ff83968c450433788607 |

### Delerion 2

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Sleep | Dormir | 1 | manual_jugador | spl_e9e08e1abb1dd4d5dcba854f64bb151c |
| Find Familiar | Encontrar familiar | 1 | manual_jugador | spl_95027b1ca50a8be591b4cf6f871a3340 |
| Illusory Script | Escritura ilusoria | 1 | manual_jugador | spl_71819c480b05ad8ec24470f139ae6761 |
| Shield | Escudo | 1 | manual_jugador | spl_68753354bf6e259a5aa0dbd67d1c4936 |
| Charm Person | Hechizar persona | 1 | manual_jugador | spl_e19af27c473c01a19e2180059550e373 |
| Mage Hand | Mano de mago | 0 | manual_jugador | spl_8cc9caaa24407e1e938b4aed63a950a0 |
| Burning Hands | Manos ardientes | 1 | manual_jugador | spl_f3fb372ac5502cd58e9dd76a5f908637 |
| Message | Mensaje | 0 | manual_jugador | spl_d903ecde867a794154fc731cd4b1ff8e |
| Chromatic Orb | Orbe cromático | 1 | manual_jugador | spl_6da87cddc6dea096af2d2ced16c10f99 |
| Prestidigitation | Prestidigitación | 0 | manual_jugador | spl_41790fbb433cbaa501198a5e2704a5a8 |
| Ray of Sickness | Rayo de dolencia | 1 | manual_jugador | spl_c479a654c0018126c186527e6146cd43 |
| Fire Bolt | Saeta de fuego | 0 | manual_jugador | spl_a4ba4ef321ff97202194e8278b037c40 |

### Draven Korr

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Absorber elementos | Absorber Elementos | 1 | xanathar | spl_e37d47e264edb162edb7a6641167a04f |
| Alarma | Alarma | 1 | manual_jugador | spl_cb146c8394846c4d7cb1da42e0056c34 |
| Aumentar característica | Aumentar característica | 2 | manual_jugador | spl_119e433eb84b3fc8baa01d40d12d8dca |
| Calentar metal | Calentar metal | 2 | manual_jugador | spl_b6242358a0524f1be514670e630a55d0 |
| Agarre electrizante | Contacto electrizante | 0 | manual_jugador | spl_8170a9e70293b7ea3f72caa139f51645 |
| Curar heridas | Curar heridas | 1 | manual_jugador | spl_e98c8a9fad85c075c3dc46431ddf53cf |
| Detectar magia | Detectar magia | 1 | manual_jugador | spl_7010a6b4ff8b86c106b648b190c0459b |
| Shatter | Estallar | 2 | manual_jugador | spl_69dbfaf62d878e79d8a69df060b4c2f2 |
| Identificar | Identificar | 1 | manual_jugador | spl_e2222be68df72dd2d4725e60a55f3661 |
| Imagen múltiple | Imagen múltiple | 2 | manual_jugador | spl_a6a386c4a86d97ceeff173696cc3896d |
| Onda atronadora | Onda atronadora | 1 | manual_jugador | spl_8a47e2137ef814c8544a7d3cb1c066e9 |
| Proyectil mágico | Proyectil mágico | 1 | manual_jugador | spl_0a0e3e06a83a0eae16667728f4d79469 |
| Reparar | Remendar | 0 | manual_jugador | spl_21a5405d40985b0610751aabc758a892 |
| Restablecimiento menor | Restablecimiento menor | 2 | manual_jugador | spl_3e5a10fae99bb51e4d39c41f9714eadf |

### Edrick Voss

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Absorber elementos | Absorber Elementos | 1 | xanathar | spl_e4c61599defc48aecdabfe8537fef498 |
| Cordón de flechas | Cordón de flechas | 2 | manual_jugador | spl_7e1636f698e8bec93fda0e9b56023409 |
| Curar heridas | Curar heridas | 1 | manual_jugador | spl_1eaa909d34bd13aa72bf7875f571d86f |
| Marca del cazador | Marca del cazador | 1 | manual_jugador | spl_ccce99551534d5d8fea6e1867267ed69 |
| Pasar sin rastro | Pasar sin dejar rastro | 2 | manual_jugador | spl_bf829cf8041b17fa280447066202498f |

### Garrick Vhal

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Arma espiritual | Arma espiritual | 2 | manual_jugador | spl_791eaba9c8a146da9b9d23cc23bcbc06 |
| Armadura de Agathys | Armadura de Agathys | 1 | manual_jugador | spl_fa800e25757d4954a5a0e962aebbb663 |
| Ayuda | Auxilio divino | 2 | manual_jugador | spl_88e75155cb9246d2bac488da276d6187 |
| Bendición | Bendecir | 1 | manual_jugador | spl_3120aed6d15a4d608d21e4647d07ca88 |
| Curar heridas | Curar heridas | 1 | manual_jugador | spl_2859e8ab6ee745259eac72341e273ac4 |
| Hallar corcel | Encontrar corcel | 2 | manual_jugador | spl_59a946bf5e8e4bcf9cf162338435d33e |
| Escudo de fe | Escudo de la fe | 1 | manual_jugador | spl_7770960a93c743df93aa4c1dc8ed7f26 |
| Inmovilizar persona | Inmovilizar persona | 2 | manual_jugador | spl_848286c35eb94c9a8092346f648a44e4 |
| Orden imperiosa | Orden imperiosa | 1 | manual_jugador | spl_a8a9dfbd83db4b7d883fa9f758492ae4 |
| Restablecimiento menor | Restablecimiento menor | 2 | manual_jugador | spl_913190ea2adc4e1488f512e859d5d1d3 |

### Maelion Vaelaris

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Burla dañina | Burla cruel | 0 | manual_jugador | spl_2dbee6e4ec06508a8e19350fa0e245da |
| Calmar emociones | Calmar emociones | 2 | manual_jugador | spl_5ca76d8c78024f35f4966feeff62b9a9 |
| Contrahechizo | Contraconjuro | 3 | manual_jugador | spl_4ad695d27b3e98e230573f21803d4562 |
| Detectar magia | Detectar magia | 1 | manual_jugador | spl_9c04714ce0b8879e09090044edf1372b |
| Disipar magia | Disipar magia | 3 | manual_jugador | spl_0e01fdd3c8445efb4e174062f9d459b6 |
| Espíritus guardianes | Espíritus guardianes | 3 | manual_jugador | spl_8f0bb532b4f445d0ece714d0023c5702 |
| Fuego feérico | Fuego feérico | 1 | manual_jugador | spl_3da45ab0186a702447703376bf3d16c5 |
| Identificar | Identificar | 1 | manual_jugador | spl_a89ec617545b5acfa21b81f5659ea8a0 |
| Ilusión menor | Ilusión menor | 0 | manual_jugador | spl_d1ff1dffc3c3189212dcee009345d2d7 |
| Invisibilidad | Invisibilidad | 2 | manual_jugador | spl_04d7c2e32fecf5742a4aea9fedf360b3 |
| Luces danzantes | Luces danzantes | 0 | manual_jugador | spl_993f2d951b78c9826d0a68bc174c4924 |
| Mano de mago | Mano de mago | 0 | manual_jugador | spl_5d5be546821128dbad83a0365cb8faef |
| Oscuridad | Oscuridad | 2 | manual_jugador | spl_4d14002facf7fc35892037bcd7ffb402 |
| Palabra de curación | Palabra sanadora | 1 | manual_jugador | spl_79fa590bc4181147aa5e8bc899a87f51 |
| Patrón hipnótico | Pauta hipnótica | 3 | manual_jugador | spl_fa85a063f0360db309aa4614030ed122 |
| Puerta dimensional | Puerta dimensional | 4 | manual_jugador | spl_aaed3773e398b1c95ed53bebc2ff0fbd |
| Sugestión | Sugestión | 2 | manual_jugador | spl_501fc92b95f7b7529341b7e1153e82aa |
| Susurros disonantes | Susurros disonantes | 1 | manual_jugador | spl_75b7ea803cd97623d5e490c0afd16a5c |

### Skitrixx "Stix Ernesto" Koboldtanz

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Blur | Contorno borroso | 2 | manual_jugador | spl_6af7617e24fc1e2bfe6ba698b3e48c83 |
| Disfrazarse | Disfrazarse | 1 | manual_jugador | spl_ad1d2bbcb0c2dcde9ecd68db80840bd9 |
| Phantasmal Force | Fuerza fantasmal | 2 | manual_jugador | spl_f3fedd4950943ae8c37579c31a086252 |
| Hechizar persona | Hechizar persona | 1 | manual_jugador | spl_b00671bedc809c557952fc6938bb2ed5 |
| Ilusión menor | Ilusión menor | 0 | manual_jugador | spl_024118eaac70a03d0fedfa9af05f4c47 |
| Impacto verdadero | Impacto verdadero | 0 | manual_jugador | spl_80bdc45939dcb177e9f63014550fb6f6 |
| Mano de mago | Mano de mago | 0 | manual_jugador | spl_656eeb0ebc212c35f6e78c956f6a1422 |
| Mensaje | Mensaje | 0 | manual_jugador | spl_1bdd8c330b134fe5c22f66207090a6ea |
| Comando | Orden imperiosa | 1 | manual_jugador | spl_0e05166ef2b96b35542ad09aabb5bfb6 |
| Sugestión | Sugestión | 2 | manual_jugador | spl_aeeb845c804b8569fb661e464140b731 |

### Varka

| Versión anterior | Versión activa | Nivel | Origen | Identificador conservado |
| --- | --- | ---: | --- | --- |
| Amigos | Amigos | 0 | manual_jugador | spl_a5f9a3f7125fb83924348ecb6539a61d |
| Armadura de Agathys | Armadura de Agathys | 1 | manual_jugador | spl_8e6878ba53557a92582c482a358af571 |
| Atar a la tierra | Atar a la Tierra | 2 | xanathar | spl_46fcf9f160b6f093426cf43ad4a3f87c |
| Brazos de Hadar | Brazos de Hadar | 1 | manual_jugador | spl_a612e2216070b0a0bf922a2b0a2f5964 |
| Causar miedo | Causar Miedo | 1 | xanathar | spl_27d4193b7ca910c4ff2fde412b3ec16e |
| Cautivar | Cautivar | 2 | manual_jugador | spl_d261259c2d1dc79d7d8990348d95d2ec |
| Entender idiomas | Comprensión idiomática | 1 | manual_jugador | spl_8325f7152151d30b135c765b1176cf9b |
| Comprensión idiomática | Comprensión idiomática | 1 | manual_jugador | spl_870f8d66d258e97d9324832eb6141ab4 |
| Congelación | Congelación | 0 | xanathar | spl_b19dab6cb2d326decbf41cf68f80b936 |
| Contrahechizo | Contraconjuro | 3 | manual_jugador | spl_39083078f3e9d7f5583e59388abd2d67 |
| Corona de locura | Corona de locura | 2 | manual_jugador | spl_5df16507d9fffec459d1ba3746ce2896 |
| Crear hoguera | Crear Hoguera | 0 | xanathar | spl_59be780440ce1dac90c83e904afa4a83 |
| Cuchilla protectora | Cuchilla protectora | 0 | manual_jugador | spl_c4703a8592657c3c5a3cde8a8440c4c8 |
| Círculo mágico | Círculo mágico | 3 | manual_jugador | spl_0f6ffffc8d80f4076842b8ba1d2c055b |
| Destierro | Destierro | 4 | manual_jugador | spl_16c9c810470f0ced500d2077e99a6af5 |
| Disipar magia | Disipar magia | 3 | manual_jugador | spl_9ac203cff9f3fc6d0b4ec1aee61af234 |
| Don de lenguas | Don de lenguas | 3 | manual_jugador | spl_9f446a659650e6237da94f6c2d108e23 |
| Enemigos abundantes | Enemigos Abundantes | 3 | xanathar | spl_81778bd36da16c5f462c03b60a3ef942 |
| Texto ilusorio | Escritura ilusoria | 1 | manual_jugador | spl_7d08c0841c4df02cf6e539e7e5140421 |
| Escritura ilusoria | Escritura ilusoria | 1 | manual_jugador | spl_dfe1dff5ddfd7b9d08ac48c53e9463b1 |
| Escudriñamiento | Escudriñamiento | 5 | manual_jugador | spl_808f47f58d9ac8f06cb783264a2aaeba |
| Espina mental | Espina Mental | 2 | xanathar | spl_7b0fbeb92c0e35a6ec734883c694d869 |
| Estallido Arcano | Estallido arcano | 0 | manual_jugador | spl_f3a9748df02cc52f3d58206e508911e8 |
| Forma gaseosa | Forma gaseosa | 3 | manual_jugador | spl_469d2f1c62ff94f01960343b6c00950b |
| Hambre de Hadar | Hambre de Hadar | 3 | manual_jugador | spl_1993bac8f55640bb18007ef60694678b |
| Hechizar Monstruo | Hechizar Monstruo | 4 | xanathar | spl_82f7b50f958ed65a6c9d4d3c6606f20f |
| Hechizar persona | Hechizar persona | 1 | manual_jugador | spl_6335273d19f9270caffd4898ca0273fb |
| Hoja de sombra | Hoja de Sombra | 2 | xanathar | spl_c0d769004edcd788689d2a86802b5623 |
| Ilusión menor | Ilusión menor | 0 | manual_jugador | spl_a5c08c9049f54fb9aa729c8f79324e50 |
| Imagen mayor | Imagen mayor | 3 | manual_jugador | spl_5ec20cd5b21be453fb909892809bf770 |
| Impacto verdadero | Impacto verdadero | 0 | manual_jugador | spl_16d0210296c17cb8fe595cdccb4ab6d5 |
| Infestación | Infestación | 0 | xanathar | spl_94fafa4adbf8d9a68ea380a58b9ff658 |
| Inmovilizar monstruo | Inmovilizar monstruo | 5 | manual_jugador | spl_2e23e6e41c2785de0974368a0feb6091 |
| Invocar demonio mayor | Invocar Demonio Mayor | 4 | xanathar | spl_44bf9655890297535e45d4aed466d04d |
| Invocar demonios menores | Invocar Demonios Menores | 3 | xanathar | spl_3250fcea1640dc695c2ce459f1156109 |
| Mano de mago | Mano de mago | 0 | manual_jugador | spl_aac6739e54cb0dba0f2d21be12b64c7b |
| Marchitar | Marchitar | 4 | manual_jugador | spl_90fc4f2f47b7277bb9f986bf20929d86 |
| Terror | Miedo | 3 | manual_jugador | spl_16ab6946f0b93d833368c1e5d3c546d5 |
| Mal de ojo | Mirada penetrante | 6 | manual_jugador | spl_44d46ef7228c3a2a64e43f135027134d |
| Nube de dagas | Nube de dagas | 2 | manual_jugador | spl_33373d53b09290ad1015e6669acf3c29 |
| Paso atronador | Paso de Trueno | 3 | xanathar | spl_ef6229f7e10b278668027b11d9973afb |
| Patrón hipnótico | Pauta hipnótica | 3 | manual_jugador | spl_66213a24b29c62ba34a45f8e062f5fe1 |
| Perdición elemental | Perdición Elemental | 4 | xanathar | spl_f98e68ca0960094f18bdaf9119ee91b6 |
| Piedra mágica | Piedra Mágica | 0 | xanathar | spl_3d1870a96a89afa0c2344411684d8239 |
| Prestidigitación | Prestidigitación | 0 | manual_jugador | spl_0851a2e1d3b7e2cfdc7ac3fa42f97f0d |
| Protección contra el bien y el mal | Protección contra el bien y el mal | 1 | manual_jugador | spl_1bf67115a0e2fc3ba79fdd6c91e0cac6 |
| Puerta dimensional | Puerta dimensional | 4 | manual_jugador | spl_a6ce17e82d8192208f9e5fc537a78fb1 |
| Reprensión infernal | Reprensión infernal | 1 | manual_jugador | spl_7df2c3dbdce8ac6e6f69674ab936a596 |
| Resplandor enfermizo | Resplandor Enfermizo | 4 | xanathar | spl_dd63eda496dc41ac2f88d87cf8b9007e |
| Retirada expeditiva | Retirada expeditiva | 1 | manual_jugador | spl_4a0f5657ca5cce0917af47353ddc878c |
| Rociada venenosa | Rociada de veneno | 0 | manual_jugador | spl_61dad8bf8b2d1773f6775a44b9591c46 |
| Sirviente invisible | Sirviente invisible | 1 | manual_jugador | spl_e980cfbc8ddbe4bfaf0af66df1e221d6 |
| Sombra de moil | Sombra de Moil | 4 | xanathar | spl_0a567418861263bd63e6e1a1ffd97307 |
| Terreno alucinatorio | Terreno alucinatorio | 4 | manual_jugador | spl_a36113085f0b0a1542c350989d220a43 |
| Llamar a los muertos | Tocar a los Muertos | 0 | xanathar | spl_0f5c517fe9feb493d5158cc933f2e150 |
| Toque helado | Toque gélido | 0 | manual_jugador | spl_57e4251ca285673542e25876cbf053a6 |
| Toque vampírico | Toque vampírico | 3 | manual_jugador | spl_5c7719fe88f7e5c9700f6cab9cf206d9 |
| Virote encantado | Virote encantado | 1 | manual_jugador | spl_ed498b7caf3f3af55e5d31f213b08e8f |
| Volar | Volar | 3 | manual_jugador | spl_e77978fbd846185e5e960ecce236cd57 |
