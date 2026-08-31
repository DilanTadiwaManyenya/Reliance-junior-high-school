-- ════════════════════════════════════════════════════════════════════
-- SEED DATA: Reliance Learning Centre – Fees Tracking Dashboard
-- 150 students, 80 parents, fee_balances for Term 3 2026
-- RUN MANUALLY via Supabase SQL Editor (not a migration)
-- ════════════════════════════════════════════════════════════════════
-- IMPORTANT: Run the schema migration first!
-- Adjust the admin_user_id below to match a real admin profile UUID.
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  -- Replace with a real profile UUID from your profiles table
  admin_user_id uuid := '00000000-0000-0000-0000-000000000001';

  -- ── Parent IDs ───────────────────────────────────────────────────
  p  uuid[] := array(select gen_random_uuid() from generate_series(1,80));

  -- ── Student IDs ──────────────────────────────────────────────────
  s  uuid[] := array(select gen_random_uuid() from generate_series(1,150));

begin

-- ════════════════════════════════════════════════════════════════════
-- PARENTS (80)
-- ════════════════════════════════════════════════════════════════════
-- We insert parents directly into the students table as denormalized
-- fields. If you have a separate parents table, adapt accordingly.

-- ════════════════════════════════════════════════════════════════════
-- STUDENTS – JUNIOR CAMPUS (75 students, indices 1-75)
-- Spread: ECD A/B (5 each), Grade 1-7 (7/grade, 3 streams, 2-3/class)
--         Form 1-2 (5/form)
-- ════════════════════════════════════════════════════════════════════

-- ECD A (5 students, no stream)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[1],  'Tadiwanashe Moyo',       'RLC-J-2401', '2020-03-14', 'ECD A', null, 'junior', 2024, 'active', 'Blessing Moyo',     '+263772456123'),
(s[2],  'Anesu Chikwanda',        'RLC-J-2402', '2020-07-22', 'ECD A', null, 'junior', 2024, 'active', 'Susan Chikwanda',   '+263712345678'),
(s[3],  'Farai Mutasa',           'RLC-J-2403', '2020-01-05', 'ECD A', null, 'junior', 2024, 'active', 'Peter Mutasa',      '+263774123456'),
(s[4],  'Chiedza Zimba',          'RLC-J-2404', '2019-11-30', 'ECD A', null, 'junior', 2024, 'active', 'Grace Zimba',       '+263782901234'),
(s[5],  'Munashe Zvobgo',         'RLC-J-2405', '2020-05-18', 'ECD A', null, 'junior', 2024, 'active', 'Tendai Zvobgo',     '+263719876543');

-- ECD B (5 students)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[6],  'Ruvimbo Dube',           'RLC-J-2406', '2019-08-12', 'ECD B', null, 'junior', 2024, 'active', 'Alice Dube',        '+263773219876'),
(s[7],  'Simbarashe Ncube',       'RLC-J-2407', '2019-04-25', 'ECD B', null, 'junior', 2024, 'active', 'James Ncube',       '+263717654321'),
(s[8],  'Nyasha Mufema',          'RLC-J-2408', '2019-12-01', 'ECD B', null, 'junior', 2024, 'active', 'Ruth Mufema',       '+263783456789'),
(s[9],  'Rutendo Mapfumo',        'RLC-J-2409', '2019-06-07', 'ECD B', null, 'junior', 2024, 'active', 'David Mapfumo',     '+263775098765'),
(s[10], 'Tinotenda Nhamo',        'RLC-J-2410', '2019-09-19', 'ECD B', null, 'junior', 2024, 'active', 'Mary Nhamo',        '+263718765432');

-- Grade 1 (streams: Blue 3, Green 2, White 2 = 7)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[11], 'Kudakwashe Chirwa',      'RLC-J-2311', '2018-02-14', 'Grade 1', 'Blue',  'junior', 2024, 'active', 'Tapiwa Chirwa',    '+263774567890'),
(s[12], 'Shamiso Gonera',         'RLC-J-2312', '2018-08-21', 'Grade 1', 'Blue',  'junior', 2024, 'active', 'Betty Gonera',     '+263712398765'),
(s[13], 'Panashe Mawere',         'RLC-J-2313', '2018-11-03', 'Grade 1', 'Blue',  'junior', 2024, 'active', 'John Mawere',      '+263772345678'),
(s[14], 'Anotida Sibanda',        'RLC-J-2314', '2018-05-17', 'Grade 1', 'Green', 'junior', 2024, 'active', 'Sarah Sibanda',    '+263783012345'),
(s[15], 'Charmaine Mushore',      'RLC-J-2315', '2018-09-28', 'Grade 1', 'Green', 'junior', 2024, 'active', 'Frank Mushore',    '+263775432109'),
(s[16], 'Garikai Chimuti',        'RLC-J-2316', '2018-03-06', 'Grade 1', 'White', 'junior', 2024, 'active', 'Anna Chimuti',     '+263719012345'),
(s[17], 'Tafadzwa Mutinhiri',     'RLC-J-2317', '2018-12-15', 'Grade 1', 'White', 'junior', 2024, 'active', 'Daniel Mutinhiri', '+263774321098');

-- Grade 2
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[18], 'Vimbai Choto',           'RLC-J-2218', '2017-04-11', 'Grade 2', 'Blue',  'junior', 2024, 'active', 'Moses Choto',      '+263713456789'),
(s[19], 'Tatenda Mhizha',         'RLC-J-2219', '2017-10-29', 'Grade 2', 'Blue',  'junior', 2024, 'active', 'Lisa Mhizha',      '+263773210987'),
(s[20], 'Primrose Chiname',       'RLC-J-2220', '2017-07-04', 'Grade 2', 'Blue',  'junior', 2024, 'active', 'Henry Chiname',    '+263781234567'),
(s[21], 'Rutendo Zinyama',        'RLC-J-2221', '2017-01-22', 'Grade 2', 'Green', 'junior', 2024, 'active', 'Claire Zinyama',   '+263774890123'),
(s[22], 'Makomborero Ndlovu',     'RLC-J-2222', '2017-06-13', 'Grade 2', 'Green', 'junior', 2024, 'active', 'Sam Ndlovu',       '+263718901234'),
(s[23], 'Sekai Chikumbi',         'RLC-J-2223', '2017-11-07', 'Grade 2', 'White', 'junior', 2024, 'active', 'Edith Chikumbi',   '+263772678901'),
(s[24], 'Leornard Mutisi',        'RLC-J-2224', '2017-03-19', 'Grade 2', 'White', 'junior', 2024, 'active', 'Gladys Mutisi',    '+263782345678');

-- Grade 3
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[25], 'Nyarai Chisango',        'RLC-J-2125', '2016-05-30', 'Grade 3', 'Blue',  'junior', 2024, 'active', 'Philip Chisango',  '+263719234567'),
(s[26], 'Tawanda Mutyambizi',     'RLC-J-2126', '2016-09-14', 'Grade 3', 'Blue',  'junior', 2024, 'active', 'Helen Mutyambizi', '+263773456701'),
(s[27], 'Lovemore Mataranyika',   'RLC-J-2127', '2016-12-08', 'Grade 3', 'Blue',  'junior', 2024, 'active', 'Joyce Mataranyika','+263784567890'),
(s[28], 'Takudzwa Chinyemba',     'RLC-J-2128', '2016-02-25', 'Grade 3', 'Green', 'junior', 2024, 'active', 'Phillip Chinyemba','+263774890234'),
(s[29], 'Nozipho Dlamini',        'RLC-J-2129', '2016-07-17', 'Grade 3', 'Green', 'junior', 2024, 'active', 'Agnes Dlamini',    '+263717654980'),
(s[30], 'Tinashe Gwaze',          'RLC-J-2130', '2016-10-02', 'Grade 3', 'White', 'junior', 2024, 'active', 'Percy Gwaze',      '+263773901234'),
(s[31], 'Rutendo Chivanga',       'RLC-J-2131', '2016-04-18', 'Grade 3', 'White', 'junior', 2024, 'active', 'Ivy Chivanga',     '+263782012345');

-- Grade 4
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[32], 'Anesu Mutize',           'RLC-J-2032', '2015-03-22', 'Grade 4', 'Blue',  'junior', 2024, 'active', 'Rose Mutize',      '+263718123456'),
(s[33], 'Tapiwa Mambara',         'RLC-J-2033', '2015-08-11', 'Grade 4', 'Blue',  'junior', 2024, 'active', 'George Mambara',   '+263773234567'),
(s[34], 'Simbisai Sadomba',       'RLC-J-2034', '2015-11-27', 'Grade 4', 'Blue',  'junior', 2024, 'active', 'Faith Sadomba',    '+263784345678'),
(s[35], 'Chiedza Ruwona',         'RLC-J-2035', '2015-06-04', 'Grade 4', 'Green', 'junior', 2024, 'active', 'Nicholas Ruwona',  '+263773456789'),
(s[36], 'Prosper Mugadzaweta',    'RLC-J-2036', '2015-01-15', 'Grade 4', 'Green', 'junior', 2024, 'active', 'Patricia Mugadza', '+263712567890'),
(s[37], 'Rosalyn Mazhambe',       'RLC-J-2037', '2015-09-09', 'Grade 4', 'White', 'junior', 2024, 'active', 'Thomas Mazhambe',  '+263774678901'),
(s[38], 'Blessing Chipika',       'RLC-J-2038', '2015-04-23', 'Grade 4', 'White', 'junior', 2024, 'active', 'Miriam Chipika',   '+263783789012');

-- Grade 5
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[39], 'Aidisahe Mandizha',      'RLC-J-1939', '2014-02-18', 'Grade 5', 'Blue',  'junior', 2024, 'active', 'Victor Mandizha',  '+263719890123'),
(s[40], 'Chipo Musundire',        'RLC-J-1940', '2014-07-30', 'Grade 5', 'Blue',  'junior', 2024, 'active', 'Ellen Musundire',  '+263773901234'),
(s[41], 'Tanaka Murambadoro',     'RLC-J-1941', '2014-11-12', 'Grade 5', 'Blue',  'junior', 2024, 'active', 'Richard Muramba',  '+263784012345'),
(s[42], 'Tariro Madzivire',       'RLC-J-1942', '2014-04-05', 'Grade 5', 'Green', 'junior', 2024, 'active', 'Violet Madzivire', '+263773123456'),
(s[43], 'Isheanesu Zvenyika',     'RLC-J-1943', '2014-09-21', 'Grade 5', 'Green', 'junior', 2024, 'active', 'Simon Zvenyika',   '+263718234567'),
(s[44], 'Panashe Shoko',          'RLC-J-1944', '2014-06-14', 'Grade 5', 'White', 'junior', 2024, 'active', 'Martha Shoko',     '+263774345678'),
(s[45], 'Tendai Munhuwepasi',     'RLC-J-1945', '2014-12-28', 'Grade 5', 'White', 'junior', 2024, 'active', 'Ernest Munhuwepasi','+263783456789');

-- Grade 6
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[46], 'Nyasha Dzingai',         'RLC-J-1846', '2013-01-09', 'Grade 6', 'Blue',  'junior', 2024, 'active', 'Rebecca Dzingai',  '+263719567890'),
(s[47], 'Shamiso Chakamba',       'RLC-J-1847', '2013-06-24', 'Grade 6', 'Blue',  'junior', 2024, 'active', 'Steven Chakamba',  '+263773678901'),
(s[48], 'Kudakwashe Mapiye',      'RLC-J-1848', '2013-10-17', 'Grade 6', 'Blue',  'junior', 2024, 'active', 'Eunice Mapiye',    '+263784789012'),
(s[49], 'Vimbainashe Rusere',     'RLC-J-1849', '2013-03-31', 'Grade 6', 'Green', 'junior', 2024, 'active', 'Lawrence Rusere',  '+263773890123'),
(s[50], 'Munyaradzi Chivore',     'RLC-J-1850', '2013-08-13', 'Grade 6', 'Green', 'junior', 2024, 'active', 'Julia Chivore',    '+263718901234'),
(s[51], 'Rutendo Gurure',         'RLC-J-1851', '2013-12-26', 'Grade 6', 'White', 'junior', 2024, 'active', 'Arnold Gurure',    '+263774012345'),
(s[52], 'Farai Ngorima',          'RLC-J-1852', '2013-05-08', 'Grade 6', 'White', 'junior', 2024, 'active', 'Hannah Ngorima',   '+263783123456');

-- Grade 7
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[53], 'Tafadzwa Bvumbe',        'RLC-J-1753', '2012-02-03', 'Grade 7', 'Blue',  'junior', 2024, 'active', 'Constance Bvumbe', '+263719234601'),
(s[54], 'Tinashe Matembe',        'RLC-J-1754', '2012-07-16', 'Grade 7', 'Blue',  'junior', 2024, 'active', 'Walter Matembe',   '+263773345678'),
(s[55], 'Ruvimbo Kurebgaseka',    'RLC-J-1755', '2012-11-29', 'Grade 7', 'Blue',  'junior', 2024, 'active', 'Dorothy Kurebga',  '+263784456789'),
(s[56], 'Munyaradzi Sigauke',     'RLC-J-1756', '2012-04-12', 'Grade 7', 'Green', 'junior', 2024, 'active', 'Rodney Sigauke',   '+263773567890'),
(s[57], 'Chiedza Gumbo',          'RLC-J-1757', '2012-09-25', 'Grade 7', 'Green', 'junior', 2024, 'active', 'Stella Gumbo',     '+263718678901'),
(s[58], 'Simbarashe Mungoshi',    'RLC-J-1758', '2012-01-18', 'Grade 7', 'White', 'junior', 2024, 'active', 'Ethel Mungoshi',   '+263774789012'),
(s[59], 'Tawanda Chidhakwa',      'RLC-J-1759', '2012-06-01', 'Grade 7', 'White', 'junior', 2024, 'active', 'Alfred Chidhakwa', '+263783890123');

-- Form 1 (5 students)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[60], 'Apisahe Nyamukapa',      'RLC-J-1660', '2011-03-07', 'Form 1', 'Blue',  'junior', 2024, 'active', 'Charles Nyamukapa','+263719901234'),
(s[61], 'Nyasha Mazodze',         'RLC-J-1661', '2011-08-20', 'Form 1', 'Green', 'junior', 2024, 'active', 'Gertrude Mazodze', '+263773012345'),
(s[62], 'Tatenda Chikondo',       'RLC-J-1662', '2011-12-13', 'Form 1', 'White', 'junior', 2024, 'active', 'Ozias Chikondo',   '+263784123456'),
(s[63], 'Rutendo Manyika',        'RLC-J-1663', '2011-05-26', 'Form 1', 'Blue',  'junior', 2024, 'active', 'Josephine Manyika','+263773234567'),
(s[64], 'Tanaka Magondo',         'RLC-J-1664', '2011-10-09', 'Form 1', 'Green', 'junior', 2024, 'active', 'Frederick Magondo','+263718345678');

-- Form 2 (5 students)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[65], 'Kudzai Madzimure',       'RLC-J-1565', '2010-01-14', 'Form 2', 'Blue',  'junior', 2024, 'active', 'Benjamin Madzimure','+263774456789'),
(s[66], 'Vongai Chiota',          'RLC-J-1566', '2010-06-27', 'Form 2', 'Green', 'junior', 2024, 'active', 'Catherine Chiota', '+263783567890'),
(s[67], 'Tafadzwa Mhike',         'RLC-J-1567', '2010-10-20', 'Form 2', 'White', 'junior', 2024, 'active', 'Emmanuel Mhike',   '+263719678901'),
(s[68], 'Makomborero Chingizi',   'RLC-J-1568', '2010-04-03', 'Form 2', 'Blue',  'junior', 2024, 'active', 'Lydia Chingizi',   '+263773789012'),
(s[69], 'Primrose Chikowore',     'RLC-J-1569', '2010-09-16', 'Form 2', 'Green', 'junior', 2024, 'active', 'Isaac Chikowore',  '+263784890123');

-- Extra junior students to reach 75
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[70], 'Chipo Mutunhu',          'RLC-J-1570', '2011-02-11', 'Form 1', 'White', 'junior', 2024, 'active', 'Naomi Mutunhu',    '+263773901234'),
(s[71], 'Garikai Mupoti',         'RLC-J-2471', '2015-07-04', 'Grade 4', 'Blue', 'junior', 2024, 'active', 'Samuel Mupoti',   '+263718012345'),
(s[72], 'Ruvimbo Matsvai',        'RLC-J-1872', '2013-04-19', 'Grade 6', 'Blue', 'junior', 2024, 'active', 'Emma Matsvai',     '+263774123456'),
(s[73], 'Tatenda Chidyausiku',    'RLC-J-1773', '2012-08-22', 'Grade 7', 'Green','junior', 2024, 'active', 'Joseph Chidyausiku','+263783234567'),
(s[74], 'Simba Muzonzini',        'RLC-J-2274', '2017-12-05', 'Grade 2', 'White','junior', 2024, 'active', 'Angela Muzonzini', '+263719345678'),
(s[75], 'Nyasha Nhekairo',        'RLC-J-2175', '2016-06-18', 'Grade 3', 'Blue', 'junior', 2024, 'active', 'Andrew Nhekairo',  '+263773456789');

-- ════════════════════════════════════════════════════════════════════
-- STUDENTS – SENIOR CAMPUS (75 students, indices 76-150)
-- Form 3-4: 3 streams (Blue/Green/White), ~6/form
-- Form 5-6: 3 streams (Commercials/Arts/Sciences), ~5/form
-- ════════════════════════════════════════════════════════════════════

-- Form 3 (Blue 6, Green 6, White 6 = 18)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[76],  'Tanaka Musweramaswe',   'RLC-S-1476', '2009-03-11', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Regina Musweramaswe','+263774567891'),
(s[77],  'Kudakwashe Mombeshora', 'RLC-S-1477', '2009-08-24', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Bernard Mombeshora','+263783678902'),
(s[78],  'Chiedza Mutswangwa',    'RLC-S-1478', '2009-12-17', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Caroline Mutswangwa','+263719789013'),
(s[79],  'Munyaradzi Masimbe',    'RLC-S-1479', '2009-05-30', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Dennis Masimbe',    '+263773890124'),
(s[80],  'Shamiso Chirichoga',    'RLC-S-1480', '2009-10-13', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Frances Chirichoga','+263784901235'),
(s[81],  'Rutendo Chivhenge',     'RLC-S-1481', '2009-02-26', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Gregory Chivhenge', '+263774012346'),
(s[82],  'Tatenda Mangena',       'RLC-S-1482', '2009-07-09', 'Form 3', 'Green', 'senior', 2024, 'active', 'Harriet Mangena',   '+263783123457'),
(s[83],  'Nyasha Tanhara',        'RLC-S-1483', '2009-11-22', 'Form 3', 'Green', 'senior', 2024, 'active', 'Ivan Tanhara',      '+263719234568'),
(s[84],  'Panashe Matare',        'RLC-S-1484', '2009-04-05', 'Form 3', 'Green', 'senior', 2024, 'active', 'Janet Matare',      '+263773345679'),
(s[85],  'Vimbai Gwenzi',         'RLC-S-1485', '2009-09-18', 'Form 3', 'Green', 'senior', 2024, 'active', 'Kenneth Gwenzi',    '+263784456790'),
(s[86],  'Farai Chigwida',        'RLC-S-1486', '2009-01-01', 'Form 3', 'Green', 'senior', 2024, 'active', 'Lorraine Chigwida', '+263774567891'),
(s[87],  'Tawanda Murinda',       'RLC-S-1487', '2009-06-14', 'Form 3', 'Green', 'senior', 2024, 'active', 'Michael Murinda',   '+263783678902'),
(s[88],  'Anotida Mapuranga',     'RLC-S-1488', '2009-10-27', 'Form 3', 'White', 'senior', 2024, 'active', 'Nancy Mapuranga',   '+263719789013'),
(s[89],  'Takudzwa Chimombe',     'RLC-S-1489', '2009-03-10', 'Form 3', 'White', 'senior', 2024, 'active', 'Oscar Chimombe',    '+263773890124'),
(s[90],  'Anesu Murwisi',         'RLC-S-1490', '2009-08-23', 'Form 3', 'White', 'senior', 2024, 'active', 'Pamela Murwisi',    '+263784901235'),
(s[91],  'Simbarashe Makwara',    'RLC-S-1491', '2009-12-06', 'Form 3', 'White', 'senior', 2024, 'active', 'Quinton Makwara',   '+263774012346'),
(s[92],  'Rutendo Zvidza',        'RLC-S-1492', '2009-05-19', 'Form 3', 'White', 'senior', 2024, 'active', 'Rachel Zvidza',     '+263783123457'),
(s[93],  'Nyarai Muzengeza',      'RLC-S-1493', '2009-09-02', 'Form 3', 'White', 'senior', 2024, 'active', 'Stanley Muzengeza', '+263719234568');

-- Form 4 (18 students, same spread)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[94],  'Tanaka Munyoro',        'RLC-S-1394', '2008-02-15', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Ursula Munyoro',   '+263773345680'),
(s[95],  'Kudakwashe Chitiyo',    'RLC-S-1395', '2008-07-28', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Victor Chitiyo',   '+263784456791'),
(s[96],  'Makomborero Manyande',  'RLC-S-1396', '2008-11-11', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Winnie Manyande',  '+263774567892'),
(s[97],  'Chipo Chirindira',      'RLC-S-1397', '2008-04-24', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Xavier Chirindira','+263783678903'),
(s[98],  'Farai Mudekunye',       'RLC-S-1398', '2008-09-07', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Yvonne Mudekunye', '+263719789014'),
(s[99],  'Shingai Mafidza',       'RLC-S-1399', '2008-01-20', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Zachary Mafidza',  '+263773890125'),
(s[100], 'Tapiwanashe Chinzou',   'RLC-S-13100','2008-06-03', 'Form 4', 'Green', 'senior', 2024, 'active', 'Amy Chinzou',     '+263784901236'),
(s[101], 'Vimbainashe Chivaro',   'RLC-S-13101','2008-10-16', 'Form 4', 'Green', 'senior', 2024, 'active', 'Brian Chivaro',   '+263774012347'),
(s[102], 'Ruvimbo Mazarura',      'RLC-S-13102','2008-03-29', 'Form 4', 'Green', 'senior', 2024, 'active', 'Clara Mazarura',  '+263783123458'),
(s[103], 'Tinashe Chigwedere',    'RLC-S-13103','2008-08-12', 'Form 4', 'Green', 'senior', 2024, 'active', 'Douglas Chigwedere','+263719234569'),
(s[104], 'Munyaradzi Manhango',   'RLC-S-13104','2008-12-25', 'Form 4', 'Green', 'senior', 2024, 'active', 'Eleanor Manhango', '+263773345681'),
(s[105], 'Nyasha Mubika',         'RLC-S-13105','2008-05-08', 'Form 4', 'Green', 'senior', 2024, 'active', 'Franklin Mubika',  '+263784456792'),
(s[106], 'Tatenda Muroyiwa',      'RLC-S-13106','2008-09-21', 'Form 4', 'White', 'senior', 2024, 'active', 'Gloria Muroyiwa',  '+263774567893'),
(s[107], 'Anotida Kudzanayi',     'RLC-S-13107','2008-02-04', 'Form 4', 'White', 'senior', 2024, 'active', 'Harold Kudzanayi', '+263783678904'),
(s[108], 'Simba Chibvuri',        'RLC-S-13108','2008-07-17', 'Form 4', 'White', 'senior', 2024, 'active', 'Irene Chibvuri',   '+263719789015'),
(s[109], 'Garikai Masvikeni',     'RLC-S-13109','2008-11-30', 'Form 4', 'White', 'senior', 2024, 'active', 'Jack Masvikeni',   '+263773890126'),
(s[110], 'Kudzi Chirimambowa',    'RLC-S-13110','2008-04-13', 'Form 4', 'White', 'senior', 2024, 'active', 'Karen Chirimambowa','+263784901237'),
(s[111], 'Blessing Chivhasa',     'RLC-S-13111','2008-08-26', 'Form 4', 'White', 'senior', 2024, 'active', 'Lester Chivhasa',  '+263774012348');

-- Form 5 (Commercials/Arts/Sciences, 5 each = 15)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[112], 'Nyarai Mhondoro',       'RLC-S-12112','2007-01-09', 'Form 5', 'Commercials','senior', 2024, 'active', 'Marvin Mhondoro','+263783123459'),
(s[113], 'Tafadzwa Muzarabani',   'RLC-S-12113','2007-06-22', 'Form 5', 'Commercials','senior', 2024, 'active', 'Nina Muzarabani', '+263719234570'),
(s[114], 'Rutendo Zvoushe',       'RLC-S-12114','2007-10-05', 'Form 5', 'Commercials','senior', 2024, 'active', 'Oliver Zvoushe',  '+263773345682'),
(s[115], 'Tanaka Gwenhure',       'RLC-S-12115','2007-03-18', 'Form 5', 'Commercials','senior', 2024, 'active', 'Penelope Gwenhu', '+263784456793'),
(s[116], 'Chiedza Mutiwi',        'RLC-S-12116','2007-08-01', 'Form 5', 'Commercials','senior', 2024, 'active', 'Quincy Mutiwi',   '+263774567894'),
(s[117], 'Simba Muchemwa',        'RLC-S-12117','2007-12-14', 'Form 5', 'Arts',        'senior', 2024, 'active', 'Rhonda Muchemwa', '+263783678905'),
(s[118], 'Vimbai Mazoe',          'RLC-S-12118','2007-05-27', 'Form 5', 'Arts',        'senior', 2024, 'active', 'Samson Mazoe',    '+263719789016'),
(s[119], 'Kudakwashe Zimuto',     'RLC-S-12119','2007-09-10', 'Form 5', 'Arts',        'senior', 2024, 'active', 'Teresa Zimuto',   '+263773890127'),
(s[120], 'Makomborero Chisveto',  'RLC-S-12120','2007-01-23', 'Form 5', 'Arts',        'senior', 2024, 'active', 'Ulrich Chisveto', '+263784901238'),
(s[121], 'Panashe Kusvina',       'RLC-S-12121','2007-06-06', 'Form 5', 'Arts',        'senior', 2024, 'active', 'Vera Kusvina',    '+263774012349'),
(s[122], 'Tatenda Mutevedzi',     'RLC-S-12122','2007-10-19', 'Form 5', 'Sciences',    'senior', 2024, 'active', 'William Mutevedzi','+263783123460'),
(s[123], 'Anesu Chironda',        'RLC-S-12123','2007-04-01', 'Form 5', 'Sciences',    'senior', 2024, 'active', 'Xena Chironda',   '+263719234571'),
(s[124], 'Farai Mugabe',          'RLC-S-12124','2007-08-14', 'Form 5', 'Sciences',    'senior', 2024, 'active', 'Yolanda Mugabe',  '+263773345683'),
(s[125], 'Ruvimbo Mashingaidze',  'RLC-S-12125','2007-12-27', 'Form 5', 'Sciences',    'senior', 2024, 'active', 'Zebediah Mashing.','+263784456794'),
(s[126], 'Nyasha Chikumbu',       'RLC-S-12126','2007-05-10', 'Form 5', 'Sciences',    'senior', 2024, 'active', 'Alice Chikumbu',  '+263774567895');

-- Form 6 (15 students: Commercials/Arts/Sciences, 5 each)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[127], 'Tawanda Mangwende',     'RLC-S-11127','2006-02-14', 'Form 6', 'Commercials','senior', 2024, 'active', 'Barbara Mangwende','+263783678906'),
(s[128], 'Chipo Mazhawidza',      'RLC-S-11128','2006-07-27', 'Form 6', 'Commercials','senior', 2024, 'active', 'Carlton Mazhawidza','+263719789017'),
(s[129], 'Simbarashe Chitima',    'RLC-S-11129','2006-11-10', 'Form 6', 'Commercials','senior', 2024, 'active', 'Debbie Chitima',  '+263773890128'),
(s[130], 'Kudakwashe Ziyambe',    'RLC-S-11130','2006-04-23', 'Form 6', 'Commercials','senior', 2024, 'active', 'Edgar Ziyambe',   '+263784901239'),
(s[131], 'Nyarai Chipamaunga',    'RLC-S-11131','2006-09-06', 'Form 6', 'Commercials','senior', 2024, 'active', 'Felicia Chipamaunga','+263774012350'),
(s[132], 'Tanaka Musonza',        'RLC-S-11132','2006-01-19', 'Form 6', 'Arts',        'senior', 2024, 'active', 'Gordon Musonza',  '+263783123461'),
(s[133], 'Rutendo Mandere',       'RLC-S-11133','2006-06-02', 'Form 6', 'Arts',        'senior', 2024, 'active', 'Helen Mandere',   '+263719234572'),
(s[134], 'Vimbainashe Machaya',   'RLC-S-11134','2006-10-15', 'Form 6', 'Arts',        'senior', 2024, 'active', 'Ibrahim Machaya', '+263773345684'),
(s[135], 'Anotida Muyambo',       'RLC-S-11135','2006-03-28', 'Form 6', 'Arts',        'senior', 2024, 'active', 'Jacinda Muyambo', '+263784456795'),
(s[136], 'Munyaradzi Chipuriro',  'RLC-S-11136','2006-08-11', 'Form 6', 'Arts',        'senior', 2024, 'active', 'Kevin Chipuriro', '+263774567896'),
(s[137], 'Shamiso Chatiza',       'RLC-S-11137','2006-12-24', 'Form 6', 'Sciences',    'senior', 2024, 'active', 'Linda Chatiza',   '+263783678907'),
(s[138], 'Anesu Mutingwende',     'RLC-S-11138','2006-05-07', 'Form 6', 'Sciences',    'senior', 2024, 'active', 'Maxwell Mutingwende','+263719789018'),
(s[139], 'Panashe Zvidzai',       'RLC-S-11139','2006-09-20', 'Form 6', 'Sciences',    'senior', 2024, 'active', 'Nicole Zvidzai',  '+263773890129'),
(s[140], 'Tatenda Mudzingwa',     'RLC-S-11140','2006-02-03', 'Form 6', 'Sciences',    'senior', 2024, 'active', 'Omar Mudzingwa',  '+263784901240'),
(s[141], 'Nyasha Chiundura',      'RLC-S-11141','2006-06-16', 'Form 6', 'Sciences',    'senior', 2024, 'active', 'Priscilla Chiundura','+263774012351');

-- Extra senior students (indices 142-150)
insert into public.students (id, full_name, admission_number, date_of_birth, class_level, class_stream, campus, enrolled_year, status, parent_name, parent_phone) values
(s[142], 'Garikai Murambinda',    'RLC-S-14142','2009-01-04', 'Form 3', 'Blue',  'senior', 2024, 'active', 'Quinton Murambinda','+263783123462'),
(s[143], 'Ruvimbo Chitanda',      'RLC-S-14143','2009-04-17', 'Form 3', 'Green', 'senior', 2024, 'active', 'Rebecca Chitanda',  '+263719234573'),
(s[144], 'Kudzi Chireki',         'RLC-S-13144','2008-06-30', 'Form 4', 'Blue',  'senior', 2024, 'active', 'Samuel Chireki',    '+263773345685'),
(s[145], 'Simba Mhonderwa',       'RLC-S-13145','2008-10-13', 'Form 4', 'Green', 'senior', 2024, 'active', 'Tina Mhonderwa',    '+263784456796'),
(s[146], 'Tatenda Mazana',        'RLC-S-12146','2007-02-26', 'Form 5', 'Commercials','senior', 2024, 'active', 'Ulyana Mazana',  '+263774567897'),
(s[147], 'Chiedza Manhenga',      'RLC-S-12147','2007-07-10', 'Form 5', 'Arts',  'senior', 2024, 'active', 'Victor Manhenga',   '+263783678908'),
(s[148], 'Farai Murehwa',         'RLC-S-12148','2007-11-23', 'Form 5', 'Sciences','senior', 2024, 'active', 'Wendy Murehwa',   '+263719789019'),
(s[149], 'Vimbai Mutimba',        'RLC-S-11149','2006-04-07', 'Form 6', 'Commercials','senior', 2024, 'active', 'Xander Mutimba', '+263773890130'),
(s[150], 'Tanaka Chitsvatsva',    'RLC-S-11150','2006-08-20', 'Form 6', 'Arts',  'senior', 2024, 'active', 'Yvonne Chitsvatsva','+263784901241');

-- ════════════════════════════════════════════════════════════════════
-- FEE BALANCES – Term 3 2026
-- Full:   50 students (s[1..50])    – 100% paid
-- Half:   70 students (s[51..120])  – 50% paid
-- Unpaid: 30 students (s[121..150]) – 0% paid
-- ════════════════════════════════════════════════════════════════════

-- FULL PAYMENT (indices 1-50 = junior students, fully paid)
insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, notes, payment_date, updated_at)
select
  s[i],
  'Term 3',
  2026,
  170,  -- junior fee
  170,
  'Full payment received',
  (current_date - (random() * 30)::int)::date,
  now() - (random() * interval '30 days')
from generate_series(1, 50) i;

-- HALF PAYMENT (junior students 51-75, senior 76-120)
-- Junior half (indices 51-75): paid $85
insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, notes, payment_date, updated_at)
select
  s[i],
  'Term 3',
  2026,
  170,
  85,
  'Partial payment received – balance outstanding',
  (current_date - (random() * 20)::int + 10)::date,
  now() - (random() * interval '20 days')
from generate_series(51, 75) i;

-- Senior half (indices 76-120): paid $100
insert into public.fee_balances (student_id, term, academic_year, total_fees, amount_paid, notes, payment_date, updated_at)
select
  s[i],
  'Term 3',
  2026,
  200,
  100,
  'Partial payment received – balance outstanding',
  (current_date - (random() * 20)::int + 10)::date,
  now() - (random() * interval '20 days')
from generate_series(76, 120) i;

-- NON-PAID – no record inserted (these will show as unpaid by default)
-- Indices 121-150 have no fee_balances row = $0 paid = Non-Paid category

end $$;
