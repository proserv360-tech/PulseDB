# Java — OTel to FATHOM

Targets the PostgreSQL JDBC driver (`org.postgresql:postgresql:42.7+`)
and either HikariCP or a Spring Boot datasource. Assumes the OpenTelemetry
Java agent is already attached to the JVM.

## Option A — application_name (recommended)

HikariCP lets you run a statement on every new physical connection via
`connectionInitSql`, but that's static. To rotate the traceparent on
every _checkout_, install a `ConnectionCustomizer`:

```java
import com.zaxxer.hikari.*;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import java.sql.Connection;

public class FathomTraceHikariInterceptor implements HikariCP.ConnectionCustomizer {
    public void customize(Connection conn) throws java.sql.SQLException {
        SpanContext ctx = Span.current().getSpanContext();
        String tp = ctx.isValid()
            ? String.format("00-%s-%s-%02x",
                ctx.getTraceId(), ctx.getSpanId(), ctx.getTraceFlags().asByte())
            : "00-unknown-unknown-00";
        try (var stmt = conn.prepareStatement("SET application_name = ?")) {
            stmt.setString(1, "traceparent:" + tp);
            stmt.execute();
        }
    }
}
```

(If your Hikari version does not expose `ConnectionCustomizer`, subclass
`HikariDataSource` and override `getConnection()` to run the statement
before returning the connection.)

## Option B — SQL comment (no driver changes)

Use the OpenTelemetry SQL commenter extension. For Spring Boot:

```xml
<dependency>
  <groupId>io.opentelemetry.instrumentation</groupId>
  <artifactId>opentelemetry-jdbc</artifactId>
  <version>2.7.0-alpha</version>
</dependency>
```

Then wrap your `DataSource`:

```java
import io.opentelemetry.instrumentation.jdbc.datasource.OpenTelemetryDataSource;

@Bean
public DataSource dataSource(DataSource delegate) {
    return JdbcTelemetry.builder(openTelemetry)
        .setStatementSanitizationEnabled(false)
        .setCaptureQueryParameters(false)
        .setAddTraceparent(true) // appends the /*traceparent='...'*/ comment
        .build()
        .wrap(delegate);
}
```

The resulting queries look like:

```sql
/*traceparent='00-...-...-01'*/ SELECT * FROM orders WHERE id = ?
```

FATHOM picks these up off `pg_stat_statements.query`.

## Verify

After deploying:

1. Hit an endpoint that issues a query.
2. In FATHOM → Query Details, expand the slow query. A "Trace"
   link should render.
3. If nothing appears, run
   `SELECT application_name FROM pg_stat_activity WHERE usename = current_user;`
   and confirm the `traceparent:` prefix is there.
