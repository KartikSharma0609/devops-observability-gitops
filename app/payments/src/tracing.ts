import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: (process.env.OTEL_URL || "http://jaeger:4318") + "/v1/traces",
  }),
  instrumentations: [getNodeAutoInstrumentations()],
}).start();
