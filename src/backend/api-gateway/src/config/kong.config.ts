// @ts-nocheck
import dotenv from 'dotenv'; // ^16.0.0 - Load environment variables for secure configuration

// Initialize environment variables
dotenv.config();

// Interfaces for type safety
interface KongConfig {
  plugins: Plugin[];
  routes: Route[];
  services: Service[];
}

interface Plugin {
  name: string;
  config: Record<string, any>;
  enabled: boolean;
  protocols: string[];
  tags: string[];
}

interface Route {
  name: string;
  paths: string[];
  service: string;
  strip_path: boolean;
  preserve_host: boolean;
  tags: string[];
  protocols: string[];
}

interface Service {
  name: string;
  url: string;
  protocol: string;
  retries: number;
  connect_timeout: number;
  write_timeout: number;
  read_timeout: number;
  tags: string[];
}

// Constants for configuration
const DEFAULT_PROTOCOL = 'https';
const DEFAULT_RETRIES = 5;
const DEFAULT_TIMEOUT = 60000;
const RATE_LIMIT = {
  POINTS: 1000,
  DURATION: 60,
  BLOCK_DURATION: 300
};
const CORS_ALLOWED_ORIGINS = ['https://*.healthcare-domain.com'];
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Core services configuration
const services: Service[] = [
  {
    name: 'workflow-service',
    url: process.env.WORKFLOW_SERVICE_URL || '',
    protocol: DEFAULT_PROTOCOL,
    retries: DEFAULT_RETRIES,
    connect_timeout: DEFAULT_TIMEOUT,
    write_timeout: DEFAULT_TIMEOUT,
    read_timeout: DEFAULT_TIMEOUT,
    tags: ['core', 'workflow', 'hipaa-compliant']
  },
  {
    name: 'document-service',
    url: process.env.DOCUMENT_SERVICE_URL || '',
    protocol: DEFAULT_PROTOCOL,
    retries: DEFAULT_RETRIES,
    connect_timeout: DEFAULT_TIMEOUT,
    write_timeout: DEFAULT_TIMEOUT * 2, // Extended for document processing
    read_timeout: DEFAULT_TIMEOUT * 2,
    tags: ['core', 'documents', 'hipaa-compliant']
  },
  {
    name: 'ai-service',
    url: process.env.AI_SERVICE_URL || '',
    protocol: DEFAULT_PROTOCOL,
    retries: DEFAULT_RETRIES,
    connect_timeout: DEFAULT_TIMEOUT,
    write_timeout: DEFAULT_TIMEOUT * 3, // Extended for AI processing
    read_timeout: DEFAULT_TIMEOUT * 3,
    tags: ['core', 'ai', 'hipaa-compliant']
  },
  {
    name: 'integration-service',
    url: process.env.INTEGRATION_SERVICE_URL || '',
    protocol: DEFAULT_PROTOCOL,
    retries: DEFAULT_RETRIES,
    connect_timeout: DEFAULT_TIMEOUT,
    write_timeout: DEFAULT_TIMEOUT,
    read_timeout: DEFAULT_TIMEOUT,
    tags: ['core', 'integration', 'hipaa-compliant']
  }
];

// Route configurations
const routes: Route[] = [
  {
    name: 'workflow-routes',
    paths: ['/api/v1/authorizations/*'],
    service: 'workflow-service',
    strip_path: false,
    preserve_host: true,
    tags: ['core', 'workflow', 'hipaa-compliant'],
    protocols: ['https']
  },
  {
    name: 'document-routes',
    paths: ['/api/v1/documents/*'],
    service: 'document-service',
    strip_path: false,
    preserve_host: true,
    tags: ['core', 'documents', 'hipaa-compliant'],
    protocols: ['https']
  },
  {
    name: 'ai-routes',
    paths: ['/api/v1/ai/*'],
    service: 'ai-service',
    strip_path: false,
    preserve_host: true,
    tags: ['core', 'ai', 'hipaa-compliant'],
    protocols: ['https']
  },
  {
    name: 'integration-routes',
    paths: ['/api/v1/integration/*'],
    service: 'integration-service',
    strip_path: false,
    preserve_host: true,
    tags: ['core', 'integration', 'hipaa-compliant'],
    protocols: ['https']
  }
];

// Security and middleware plugins
const plugins: Plugin[] = [
  {
    name: 'jwt',
    config: {
      uri: process.env.AUTH0_DOMAIN,
      audience: process.env.AUTH0_AUDIENCE,
      algorithms: ['RS256'],
      run_on_preflight: true,
      cookie_secure: true,
      cookie_httponly: true,
      cookie_samesite: 'strict'
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'authentication']
  },
  {
    name: 'rate-limiting',
    config: {
      minute: RATE_LIMIT.POINTS,
      policy: 'redis',
      redis_url: process.env.REDIS_URL,
      fault_tolerant: true,
      hide_client_headers: false,
      block_on_first_violation: true,
      error_code: 429,
      error_message: 'API rate limit exceeded'
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'rate-limiting']
  },
  {
    name: 'cors',
    config: {
      origins: CORS_ALLOWED_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      headers: ['Authorization', 'Content-Type', 'X-Request-ID'],
      exposed_headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      credentials: true,
      max_age: 3600,
      preflight_continue: false
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'cors']
  },
  {
    name: 'request-transformer',
    config: {
      add: {
        headers: ['X-Request-ID:$(uuid)'],
        querystring: ['request_timestamp:$(date)']
      }
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'request-handling']
  },
  {
    name: 'response-transformer',
    config: {
      add: {
        headers: SECURITY_HEADERS
      }
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'response-handling']
  },
  {
    name: 'http-log',
    config: {
      http_endpoint: process.env.AUDIT_LOG_URL,
      timeout: 10000,
      keepalive: 60000,
      method: 'POST',
      content_type: 'application/json',
      custom_fields_by_lua: {
        user_id: 'return kong.client.get_consumer()',
        request_timestamp: 'return os.time()',
        request_id: 'return kong.request.get_header("X-Request-ID")'
      }
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'audit']
  },
  {
    name: 'ip-restriction',
    config: {
      allow: process.env.ALLOWED_IPS?.split(',') || [],
      status: 403,
      message: 'Access denied'
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'access-control']
  },
  {
    name: 'ssl',
    config: {
      cert: process.env.SSL_CERT_PATH,
      key: process.env.SSL_KEY_PATH,
      only_https: true,
      prefer_server_ciphers: true,
      ssl_version: 'TLSv1_2+',
      ciphers: 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'
    },
    enabled: true,
    protocols: ['https'],
    tags: ['security', 'encryption']
  }
];

// Export the complete Kong configuration
export const kongConfig: KongConfig = {
  plugins,
  routes,
  services
};

export default kongConfig;