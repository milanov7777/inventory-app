-- Wipe all data and re-insert clean
DELETE FROM approved;
DELETE FROM testing;
DELETE FROM received;
DELETE FROM on_website;
DELETE FROM audit_log;
DELETE FROM orders;

-- ALL ORDERS: active + parent stubs
-- Columns: sku, compound_mg, qty_ordered, batch_number, vendor, unit_price, date_ordered, tracking_number, shipping_cost, logged_by, notes, status
INSERT INTO orders (sku, compound_mg, qty_ordered, batch_number, vendor, unit_price, date_ordered, tracking_number, shipping_cost, logged_by, notes, status) VALUES
  ('P-011', 'GLP-1SM 10MG', 250, 'NV-P-JF9V', 'Andy', 5.00, '2026-03-16', '870158707169', 0, 'CAMILA', 'PACKAGE 1 - $225 shipping total', 'ordered'),
  ('P-036', 'TB-500 10MG', 250, 'NV-P-7QXM', 'Andy', 11.00, '2026-03-16', '870158707169', 0, 'CAMILA', 'PACKAGE 1', 'ordered'),
  ('P-033', 'SEMAX 10MG', 500, 'NV-P-YJ1L', 'Andy', 7.00, '2026-03-16', NULL, 0, 'CAMILA', 'PACKAGE 5', 'ordered'),
  ('P-039', 'GLP-2TZ 30MG', 250, 'NV-P-H8CY', 'Andy', 10.30, '2026-03-16', '870158715281', 0, 'CAMILA', 'PACKAGE 2', 'ordered'),
  ('R-003', 'Acetic Acid', 200, 'RS-A45', 'Andy', 1.00, '2026-03-16', '870158715281', 0, 'CAMILA', 'PACKAGE 2', 'ordered'),
  ('P-003', 'TB-500 5MG', 500, 'NV-P-F7H5', 'Chris', 6.50, '2026-04-03', NULL, 600, 'AIDEN', '250 GOING TO BRETT - 1/4 shipping $600', 'ordered'),
  ('P-014', 'GLP-3RT 5MG', 2500, 'NV-P-073K', 'Chris', 5.00, '2026-04-03', NULL, 0, 'AIDEN', '2/4', 'ordered'),
  ('P-035', 'GHK-CU 100MG', 500, 'NV-P-C2ZT', 'Chris', 4.00, '2026-04-03', NULL, 0, 'AIDEN', '3/4', 'received'),
  ('P-012', 'GLP-2TZ 10MG', 500, 'NV-P-AO1B', 'Chris', 5.00, '2026-04-03', NULL, 0, 'CAMILA', '250 GOING TO BRETT - 4/4', 'ordered'),
  ('P-031', 'KPV', 150, 'NV-P-S8C6', 'Chris', 6.00, NULL, NULL, 0, 'CAMILA', NULL, 'received'),
  ('P-010', 'HCG', 750, 'NV-P-XJ18', 'Edison', 7.00, '2026-03-09', NULL, 0, 'CAMILA', NULL, 'in_testing'),
  ('P-014', 'GLP-3RT 5MG', 500, 'NV-P-P5P8', 'Chris', 5.00, '2026-03-11', NULL, 0, 'CAMILA', NULL, 'received'),
  ('P-007', 'GHK-CU 50MG', 1000, 'NV-P-WV0C', 'Chris', 3.00, '2026-03-11', NULL, 0, 'CAMILA', NULL, 'received'),
  ('C-004', '5-AMINO 50MG', 250, 'NV-C-Q7L2', 'Brett', 10.00, '2026-04-02', NULL, 0, 'CAMILA', NULL, 'received'),
  ('C-005', 'KPV 500 MCG', 250, 'NV-C-A9VL', 'Brett', 10.00, '2026-04-02', NULL, 0, 'CAMILA', NULL, 'received'),
  ('L-003', 'RU-58841', 0, 'NV-L-6TJK', NULL, 0, NULL, NULL, 0, 'CAMILA', NULL, 'in_testing'),
  ('L-004', 'AMMINOTADALAFIL', 0, 'NV-L-PHQ9', NULL, 0, NULL, NULL, 0, 'CAMILA', NULL, 'in_testing'),
  ('P-030', 'IGF-1 LR3', 210, 'NV-P-XRXV', 'Andy', 19.05, '2026-01-29', NULL, 0, 'CAMILA', NULL, 'in_testing'),
  ('P-037', 'BPC/TB 10MG', 500, 'NV-P-3HVE', 'Andy', 19.00, '2026-03-16', NULL, 0, 'AIDEN', NULL, 'in_testing'),
  ('P-038', 'TESAMORELIN 20MG', 500, 'NV-P-U5KR', 'Andy', 28.00, '2026-03-16', NULL, 0, 'AIDEN', NULL, 'in_testing'),
  ('P-001', 'BPC 5mg', 450, 'NV-P-N74B', NULL, 0, NULL, NULL, 0, 'CAMILA', NULL, 'approved'),
  ('P-015', 'GLP-3 RT 10MG', 1500, 'NV-P-I3TV', 'Chris', 7.00, '2026-02-12', NULL, 0, 'PEYTON', NULL, 'approved'),
  ('P-021', 'Melanotan 2', 500, 'NV-P-276J', 'Chris', 4.60, '2026-01-27', NULL, 0, 'PEYTON', NULL, 'approved'),
  ('P-018', 'Tesamorelin 5mg', 250, 'NV-P-NBGV', 'Chris', 9.40, '2026-01-27', NULL, 0, 'PEYTON', NULL, 'approved');

-- RECEIVED
INSERT INTO received (batch_number, sku, compound_mg, qty_received, date_received, storage, cap_color, logged_by) VALUES
  ('NV-P-S8C6', 'P-031', 'KPV', 150, NULL, 'fridge', 'GREEN', 'CAMILA'),
  ('NV-P-XJ18', 'P-010', 'HCG', 750, NULL, 'fridge', 'BLUE', 'CAMILA'),
  ('NV-P-P5P8', 'P-014', 'GLP-3RT 5MG', 500, NULL, 'shelf', 'RED', 'CAMILA'),
  ('NV-P-WV0C', 'P-007', 'GHK-CU 50MG', 1000, NULL, 'shelf', NULL, 'CAMILA'),
  ('NV-P-C2ZT', 'P-035', 'GHK-CU 100MG', 1000, NULL, 'shelf', NULL, 'CAMILA'),
  ('NV-C-Q7L2', 'C-004', '5-AMINO 50MG', 250, NULL, 'shelf', NULL, 'CAMILA'),
  ('NV-C-A9VL', 'C-005', 'KPV 500 MCG', 250, NULL, 'shelf', NULL, 'CAMILA');

-- TESTING
INSERT INTO testing (batch_number, sku, compound_mg, lab, vials_sent, date_sent, logged_by, notes) VALUES
  ('NV-L-6TJK', 'L-003', 'RU-58841', 'FREEDOM', NULL, NULL, 'CAMILA', 'BLUE- FREEDOM'),
  ('NV-L-PHQ9', 'L-004', 'AMMINOTADALAFIL', NULL, NULL, NULL, 'CAMILA', NULL),
  ('NV-P-XJ18', 'P-010', 'HCG', NULL, 750, NULL, 'CAMILA', NULL),
  ('NV-P-XRXV', 'P-030', 'IGF-1 LR3', 'VANGUARD', 210, NULL, 'CAMILA', NULL),
  ('NV-P-3HVE', 'P-037', 'BPC/TB 10MG', NULL, 500, NULL, 'AIDEN', NULL),
  ('NV-P-U5KR', 'P-038', 'TESAMORELIN 20MG', NULL, 500, NULL, 'AIDEN', NULL);

-- APPROVED
INSERT INTO approved (batch_number, sku, compound_mg, qty_available, approved_date, storage, logged_by, notes) VALUES
  ('NV-P-N74B', 'P-001', 'BPC 5mg', 450, NULL, 'shelf', 'CAMILA', 'YELLOW cap'),
  ('NV-P-I3TV', 'P-015', 'GLP-3 RT 10MG', 1500, NULL, 'shelf', 'PEYTON', 'YELLOW cap'),
  ('NV-P-276J', 'P-021', 'Melanotan 2', 500, NULL, 'shelf', 'PEYTON', 'YELLOW cap'),
  ('NV-P-NBGV', 'P-018', 'Tesamorelin 5mg', 250, NULL, 'shelf', 'PEYTON', 'WHITE cap');

-- Verify
SELECT 'orders' as tbl, count(*) as rows FROM orders
UNION ALL SELECT 'received', count(*) FROM received
UNION ALL SELECT 'testing', count(*) FROM testing
UNION ALL SELECT 'approved', count(*) FROM approved;
