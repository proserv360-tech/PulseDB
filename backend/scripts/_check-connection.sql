SELECT id, name,
       CASE WHEN password IS NULL THEN 'null'
            WHEN length(password) > 40 AND password LIKE '%:%' THEN 'encrypted (' || length(password) || ' chars)'
            ELSE 'plaintext or short' END AS password_state,
       host, port, database, username
FROM pgmonitoringtool.fathom_connections
ORDER BY id;
