import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { type IMetricReader, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { Logger } from "@typeberry/logger";

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  prometheusPort: number;
  enabled: boolean;
  otlpEndpoint?: string;
}

const logger = Logger.new(import.meta.filename, "tele");

export function initializeTelemetry(config: TelemetryConfig): NodeSDK | null {
  // Check if telemetry is disabled
  if (config.enabled === false) {
    logger.info`OpenTelemetry disabled`;
    return null;
  }

  const { serviceName, serviceVersion, prometheusPort, otlpEndpoint } = config;

  // Create resource with service information
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  });
  const resource = defaultResource().merge(customResource);

  // Setup metric exporters
  const metricReaders: IMetricReader[] = [];

  // Prometheus exporter (pull-based)
  const prometheusExporter = new PrometheusExporter({
    port: prometheusPort,
  });
  metricReaders.push(prometheusExporter);

  logger.info`Prometheus metrics available at http://localhost:${prometheusPort}/metrics`;

  // OTLP exporter (push-based) - only if endpoint is configured
  if (otlpEndpoint !== undefined) {
    const otlpExporter = new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
    });

    const otlpReader = new PeriodicExportingMetricReader({
      exporter: otlpExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds
    });

    metricReaders.push(otlpReader);
    logger.info`OTLP metrics will be exported to ${otlpEndpoint}`;
  }

  // Initialize the SDK
  const sdk = new NodeSDK({
    resource,
    metricReaders,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable specific instrumentations if needed
        "@opentelemetry/instrumentation-fs": {
          enabled: false, // File system instrumentation can be noisy
        },
      }),
    ],
  });

  try {
    sdk.start();
    logger.info`OpenTelemetry initialized for service: ${serviceName}`;

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      await shutdownTelemetry(sdk);
    });

    process.on("SIGINT", async () => {
      await shutdownTelemetry(sdk);
    });
  } catch (error) {
    logger.error`Error initializing OpenTelemetry: ${error}`;
  }

  return sdk;
}

export async function shutdownTelemetry(sdk?: NodeSDK): Promise<void> {
  if (sdk !== undefined) {
    try {
      await sdk.shutdown();
      logger.info`OpenTelemetry shut down successfully`;
    } catch (error) {
      logger.error`Error shutting down OpenTelemetry: ${error}`;
    }
  }
}
