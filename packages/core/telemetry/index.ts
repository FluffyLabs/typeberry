import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import { type IMetricReader, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { Logger } from "@typeberry/logger";
import { env } from "@typeberry/utils";
import packageJson from "./package.json" with { type: "json" };

const logger = Logger.new(import.meta.filename, "tele");

export interface TelemetryConfig {
  isMain?: boolean;
  nodeName: string;
  worker: string;
}

export function initializeTelemetry(config: TelemetryConfig) {
  return initializeTelemetryFull({
    isMain: config.isMain ?? false,
    serviceName: `typeberry-${config.nodeName}`,
    serviceVersion: packageJson.version,
    enabled: env.OTEL_ENABLED !== "false",
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:9090/api/v1/otlp",
    resourceAttributes: {
      "worker.type": config.worker,
    },
  });
}

interface TelemetryConfigFull {
  isMain: boolean;
  serviceName: string;
  serviceVersion: string;
  enabled: boolean;
  otlpEndpoint: string;
  /** Additional attributes to add to the resource */
  resourceAttributes: Record<string, string>;
}

function initializeTelemetryFull(config: TelemetryConfigFull): NodeSDK | null {
  // Check if telemetry is disabled
  if (config.enabled === false) {
    logger.info`📳 OpenTelemetry disabled`;
    return null;
  }

  const { serviceName, serviceVersion, otlpEndpoint, resourceAttributes = {} } = config;

  // Create resource with service information
  const customResource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    ...resourceAttributes,
  });
  const resource = defaultResource().merge(customResource);

  // Setup metric exporters
  const metricReaders: IMetricReader[] = [];

  // NOTE [ToDr] We would probably want to expose prometheus metrics endpoint
  // as well, however because the we use multiple worker threads we need a way
  // to collect metrics across all of these threads. One way is for each thread
  // to expose a separate endpoint on different port. Another to pass the
  // metrics somehow to single thread and aggregate them there.
  // We will have similar problem with TART (JIP-3) later, so we can work on
  // shared solution.
  // For now we are only able to push metrics to the server, and each thread
  // can do that separately, since it will be aggregated anyway.

  // OTLP exporter (push-based)
  const otlpExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
  });

  const otlpReader = new PeriodicExportingMetricReader({
    exporter: otlpExporter,
    exportIntervalMillis: 3_000,
  });

  metricReaders.push(otlpReader);

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
    if (config.isMain) {
      logger.info`📳 OTLP metrics will be exported to ${otlpEndpoint}`;
    }
  } catch (error) {
    logger.error`🔴 Error initializing OpenTelemetry: ${error}`;
  }

  return sdk;
}

export async function shutdownTelemetry(sdk: NodeSDK | null): Promise<void> {
  if (sdk !== null) {
    try {
      await sdk.shutdown();
      logger.trace`📳 OpenTelemetry shut down successfully`;
    } catch (error) {
      logger.error`🔴 Error shutting down OpenTelemetry: ${error}`;
    }
  }
}
