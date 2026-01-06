-- Set max_allowed_packet to 300MB for MySQL (to support 200MB files with Base64 encoding overhead)
-- Run this as a MySQL administrator

-- For current session (temporary)
SET SESSION max_allowed_packet = 314572800;

-- For global (permanent, requires SUPER privilege)
SET GLOBAL max_allowed_packet = 314572800;

-- To make it permanent, also add to MySQL config file (my.ini on Windows, my.cnf on Linux):
-- [mysqld]
-- max_allowed_packet=300M

