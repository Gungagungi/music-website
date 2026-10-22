-- Hand-edited after drizzle-kit generate, which emits a bare NOT NULL column.
-- On a populated database that statement fails, and bootstrap never re-seeds a
-- populated database (see src/db/bootstrap.ts): production would either refuse
-- to migrate or keep an empty column. So the column is added nullable, filled
-- from data/products.json as of this migration, and only then made NOT NULL.
ALTER TABLE "products" ADD COLUMN "meta_description" text;--> statement-breakpoint
UPDATE "products" AS p SET "meta_description" = v.meta_description
FROM (VALUES
  ('PRD-0001', 'Stratocaster Player II à manche érable : corps aulne, trois micros simple bobinage et 22 frettes pour le son Fender clair et incisif.'),
  ('PRD-0002', 'Telecaster American Professional III : corps frêne, touche palissandre et deux simples bobinages. Le twang Fender, fabriqué aux États-Unis.'),
  ('PRD-0003', 'Les Paul Standard 60s : corps acajou, table érable flammé et deux humbuckers. Le manche et le son des Gibson du début des années 60.'),
  ('PRD-0004', 'Gibson SG Standard : corps et manche acajou, deux humbuckers et une double découpe qui libère l’accès aux aigus. Un classique du rock.'),
  ('PRD-0005', 'Epiphone Les Paul Classic : corps acajou, table érable et deux humbuckers. La silhouette Les Paul à un prix accessible.'),
  ('PRD-0006', 'Squier Classic Vibe 60s Stratocaster : trois simples bobinages, touche laurier et 21 frettes pour un son Strat vintage à petit budget.'),
  ('PRD-0007', 'Ibanez RG550 Genesis : corps tilleul, manche fin érable/noyer, 24 frettes et micros HSH. La guitare de shred des années 80, rééditée.'),
  ('PRD-0008', 'Ibanez AZ2402 Prestige : manche érable rôti, 24 frettes et deux humbuckers. Une guitare japonaise polyvalente au jeu très confortable.'),
  ('PRD-0009', 'PRS SE Custom 24 : corps acajou, table érable, deux humbuckers et 24 frettes. La PRS emblématique dans sa version abordable.'),
  ('PRD-0010', 'Harley Benton ST-62 : corps tilleul, trois simples bobinages et touche laurier. Une guitare de type Strat pour débuter sans se ruiner.'),
  ('PRD-0011', 'ESP LTD EC-256 : corps et manche acajou, deux humbuckers et touche jatoba. Une simple découpe taillée pour le rock et le metal.'),
  ('PRD-0012', 'Jackson Soloist SL2 : manche érable, touche ébène, deux humbuckers et 24 frettes. Une guitare de metal rapide et précise.'),
  ('PRD-0013', 'Gretsch G2622 Streamliner : demi-caisse en érable laminé et deux micros Broad’Tron. Le son Gretsch, du rockabilly au rock garage.'),
  ('PRD-0014', 'Martin D-28 Standard : dreadnought en épicéa Sitka et palissandre, touche ébène. La référence de la guitare folk, sans électronique.'),
  ('PRD-0015', 'Taylor 214ce Plus : grand auditorium en épicéa Sitka et koa laminé, pan coupé et électronique Expression System 2 pour la scène.'),
  ('PRD-0016', 'Yamaha FG800M : dreadnought à table épicéa massif, dos et éclisses nato. Une guitare acoustique fiable et abordable pour bien débuter.'),
  ('PRD-0017', 'Harley Benton D-120CE : dreadnought à pan coupé, table épicéa et électronique intégrée. Une électro-acoustique d’entrée de gamme.'),
  ('PRD-0018', 'Gibson J-45 Studio Walnut : épaules arrondies, table épicéa Sitka, dos noyer et micro LR Baggs VTC. Le classique acoustique de Gibson.'),
  ('PRD-0019', 'Cort Earth 70 OP : dreadnought à table épicéa massif, dos et éclisses acajou, finition pores ouverts. Une guitare folk à petit prix.'),
  ('PRD-0020', 'Fender CD-60SCE All Mahogany : dreadnought à pan coupé tout acajou et préampli Fishman. Un son chaud et doux, prêt à brancher.'),
  ('PRD-0021', 'Takamine GD30CE : dreadnought à pan coupé, table épicéa massif, dos acajou et préampli TP-4TD avec accordeur intégré.'),
  ('PRD-0022', 'Yamaha C40 II : guitare classique 4/4 à table épicéa et cordes nylon. Le modèle de référence pour apprendre la guitare.'),
  ('PRD-0023', 'Alhambra 3C : guitare classique espagnole 4/4, table cèdre massif et dos sapelli. Un son chaud pour poursuivre l’étude.'),
  ('PRD-0024', 'Harley Benton CG-200 3/4 : guitare classique taille 3/4 à cordes nylon, adaptée aux enfants et aux débuts à petit budget.'),
  ('PRD-0025', 'Cordoba C5 Cedar : guitare classique 4/4, table cèdre massif, dos et éclisses acajou. Un timbre chaleureux et un manche confortable.'),
  ('PRD-0026', 'Ortega R121 : guitare classique 4/4 de la Family Series, table épicéa et dos catalpa. Légère et facile à jouer pour débuter.'),
  ('PRD-0027', 'La Mancha Rubinito CM 63 : guitare classique 7/8 à table cèdre et dos sapelli. Une taille intermédiaire pour les petites mains.'),
  ('PRD-0028', 'Fender Player II Precision Bass : corps aulne, micro split coil et 4 cordes. Le grave rond et puissant de la P-Bass.'),
  ('PRD-0029', 'Fender American Pro II Jazz Bass V : basse 5 cordes, corps aulne et deux simples bobinages. Le son Jazz Bass étendu dans le grave.'),
  ('PRD-0030', 'Music Man StingRay Special 4H : corps frêne, manche érable rôti et humbucker. Le punch de la StingRay dans sa version modernisée.'),
  ('PRD-0031', 'Ibanez SR300E : basse 4 cordes au manche fin, deux micros PowerSpan et préampli actif. Légère et polyvalente, pour tous les styles.'),
  ('PRD-0032', 'Harley Benton PB-50 : basse de type Precision, corps tilleul et micro split coil. Une 4 cordes vintage pour débuter à petit prix.'),
  ('PRD-0033', 'Höfner Ignition Bass SB : la basse violon à deux micros Staple et manche court. La silhouette et le son des années 60.'),
  ('PRD-0034', 'Yamaha TRBX304 : basse 4 cordes à corps acajou et micros P/J actifs. Une basse équilibrée et polyvalente, de la répétition à la scène.'),
  ('PRD-0035', 'Cort Action DLX AS : basse 4 cordes à corps frêne et micros PJ actifs. Une basse polyvalente au rapport qualité-prix soigné.'),
  ('PRD-0036', 'Fender Blues Junior IV : ampli à lampes 15 W, haut-parleur 12" et réverbe. Le combo blues compact, du son clair au crunch.'),
  ('PRD-0037', 'Marshall DSL40CR : combo à lampes 40 W, deux canaux, réverbe et haut-parleur 12". Le son Marshall, du crunch au gain élevé.'),
  ('PRD-0038', 'Boss Katana-50 MkII : ampli à modélisation 50 W, haut-parleur 12", cinq types d’ampli et plus de 60 effets, de la maison à la répétition.'),
  ('PRD-0039', 'Orange Crush 20RT : ampli transistor 20 W, deux canaux, réverbe et accordeur intégré. Le son Orange pour travailler à la maison.'),
  ('PRD-0040', 'Vox AC15C1 : combo à lampes 15 W, haut-parleur 12", deux canaux, réverbe et trémolo. Le son britannique de la classe A.'),
  ('PRD-0041', 'Blackstar HT-5R MkIII : ampli à lampes 5 W, deux canaux, réverbe et haut-parleur 12". Le son lampes à volume d’appartement.'),
  ('PRD-0042', 'Harley Benton HB-20R : ampli transistor 20 W, deux canaux et réverbe. Un petit combo pour travailler chez soi sans se ruiner.'),
  ('PRD-0043', 'Positive Grid Spark 40 : ampli à modélisation 40 W, Bluetooth et application mobile. Pour jouer sur des morceaux et explorer les sons.'),
  ('PRD-0044', 'Ampeg Rocket Bass RB-115 : combo basse 200 W, haut-parleur 15" et sortie DI. Le grave Ampeg, de la répétition à la petite scène.'),
  ('PRD-0045', 'Markbass CMD 121P : combo basse 300 W en 12" pour 13 kg. Un ampli puissant et facile à transporter.'),
  ('PRD-0046', 'Fender Rumble 100 V3 : combo basse 100 W, haut-parleur 12" et overdrive intégré. Léger, simple et assez fort pour répéter.'),
  ('PRD-0047', 'Hartke HD75 : combo basse 75 W, haut-parleur 12" et égaliseur 3 bandes. Un ampli compact pour s’entraîner.'),
  ('PRD-0048', 'Harley Benton BA-40B : combo basse 40 W, haut-parleur 10" et égaliseur 3 bandes. Un petit ampli pour débuter à la maison.'),
  ('PRD-0049', 'Gallien-Krueger MB110 : combo basse 100 W en 10" pour 10 kg. Le son GK dans un format très compact.'),
  ('PRD-0050', 'Boss DS-1 Distortion : pédale de distorsion à trois réglages, alimentée en 9 V. La distorsion orange, classique du rock.'),
  ('PRD-0051', 'Ibanez TS9 Tube Screamer : overdrive à trois réglages qui met les médiums en avant. La pédale de référence pour pousser un ampli.'),
  ('PRD-0052', 'Electro Harmonix Big Muff Pi : fuzz à trois réglages en true bypass. Un sustain épais et un grain massif, du rock psyché au stoner.'),
  ('PRD-0053', 'Strymon BigSky MX : réverbe haut de gamme, 300 presets et true bypass sélectionnable. Des salles, des ressorts et des nappes de studio.'),
  ('PRD-0054', 'MXR M234 Analog Chorus : chorus analogique à quatre réglages en true bypass. Une modulation chaude et ample.'),
  ('PRD-0055', 'Dunlop Cry Baby GCB95 : la pédale wah standard, alimentée en 9 V. Le son wah des années 60 à aujourd’hui.'),
  ('PRD-0056', 'TC Electronic Polytune 3 : accordeur polyphonique en true bypass avec buffer intégré. Toutes les cordes s’accordent d’un seul coup.'),
  ('PRD-0057', 'Harley Benton Vintage Overdrive : overdrive à trois réglages en true bypass. Une saturation de type Tube Screamer à tout petit prix.'),
  ('PRD-0058', 'Line 6 HX Stomp XL : multi-effets compact à 8 blocs simultanés, avec chargement d’IR. Toute une chaîne d’effets au pied.'),
  ('PRD-0059', 'Daddario EXL110 10-46 : jeu de cordes électriques en nickel, tirant regular light. La référence polyvalente pour guitare électrique.'),
  ('PRD-0060', 'Ernie Ball Regular Slinky 10-46 : cordes électriques en nickel. Le jeu Slinky de référence, au son brillant et équilibré.'),
  ('PRD-0061', 'Ernie Ball Super Slinky 3-Pack : trois jeux de cordes électriques 9-42 en nickel. Un tirant léger pour des bends faciles.'),
  ('PRD-0062', 'Elixir Nanoweb Phosphor Bronze 12-53 : cordes acoustiques en bronze phosphoreux, avec un revêtement Nanoweb qui prolonge leur durée de vie.'),
  ('PRD-0063', 'Daddario EXL170 45-100 : jeu de cordes en nickel pour basse 4 cordes. Un son rond et une sensation souple sous les doigts.'),
  ('PRD-0064', 'Savarez 520R : jeu de cordes nylon pour guitare classique, tension normale. Un son clair et équilibré pour l’étude.'),
  ('PRD-0065', 'Rotosound Swing Bass 66 45-105 : cordes en acier inoxydable pour basse 4 cordes. Le son brillant et mordant des années 60 et 70.'),
  ('PRD-0066', 'Fender Deluxe Molded Case : étui rigide de 3,9 kg pour Stratocaster et Telecaster. Protège la guitare en transport et en tournée.'),
  ('PRD-0067', 'Hercules GS414B Plus : stand guitare ou basse avec système Auto Grip qui se referme sur le manche. Stable et sûr.'),
  ('PRD-0068', 'Dunlop Tortex Standard .88 : 12 médiators de 0,88 mm à la prise antidérapante et à l’attaque nette. Un classique pour toutes les guitares.'),
  ('PRD-0069', 'Boss PSA-230ES : alimentation 9 V DC 200 mA pour pédales Boss et compatibles. Remplace les piles sur le pedalboard.'),
  ('PRD-0070', 'Cordial CSI 6 PP : câble instrument jack/jack de 6 m. Un câble robuste pour relier guitare ou basse à l’ampli.'),
  ('PRD-0071', 'Shure GLXD16+ : système sans fil numérique pour guitare, bandes 2,4 et 5,8 GHz et 12 h d’autonomie. Le récepteur tient dans un format pédale.'),
  ('PRD-0072', 'Ernie Ball Polypro : sangle en polypropylène réglable de 96 à 152 cm. Simple, légère et résistante.'),
  ('PRD-0073', 'Planet Waves Pro-Winder : bobineur de cordes avec coupe-cordes intégré, compatible avec toutes les guitares. Pour changer de cordes en un instant.')
) AS v(id, meta_description)
WHERE p."id" = v.id;--> statement-breakpoint
-- A product added by an operator is not in the seed. It falls back to its own
-- description, cut to the same 155 characters, rather than blocking the migration.
UPDATE "products" SET "meta_description" = CASE
  WHEN char_length("description") <= 155 THEN "description"
  ELSE left("description", 154) || '…'
END
WHERE "meta_description" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "meta_description" SET NOT NULL;
