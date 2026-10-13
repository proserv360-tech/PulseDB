SELECT to_regclass('pgmonitoringtool.organizations')::text AS organizations,
       to_regclass('pgmonitoringtool.notification_destinations')::text AS destinations,
       to_regclass('pgmonitoringtool.alerts')::text AS alerts;
