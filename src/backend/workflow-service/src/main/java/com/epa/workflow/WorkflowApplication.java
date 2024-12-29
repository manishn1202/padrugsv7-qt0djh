package com.epa.workflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.core.task.AsyncTaskExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PreDestroy;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;

/**
 * Main application class for the Enhanced Prior Authorization Workflow Service.
 * Provides enterprise-grade configuration for async processing, service discovery,
 * and clinical criteria evaluation through Drools integration.
 *
 * @version 1.0
 */
@SpringBootApplication(scanBasePackages = "com.epa.workflow")
@EnableDiscoveryClient
@EnableAsync(proxyTargetClass = true)
public class WorkflowApplication {

    private static final Logger logger = LoggerFactory.getLogger(WorkflowApplication.class);
    private static final int CORE_POOL_SIZE = 8;
    private static final int MAX_POOL_SIZE = 32;
    private static final int QUEUE_CAPACITY = 100;
    private static final String THREAD_NAME_PREFIX = "workflow-async-";
    
    private ConfigurableApplicationContext applicationContext;

    /**
     * Application entry point with enhanced error handling and graceful shutdown.
     * 
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        try {
            SpringApplication app = new SpringApplication(WorkflowApplication.class);
            app.setRegisterShutdownHook(true);
            
            // Configure application properties
            app.addListeners(event -> {
                if (event instanceof org.springframework.boot.context.event.ApplicationFailedEvent) {
                    logger.error("Application failed to start", ((org.springframework.boot.context.event.ApplicationFailedEvent) event).getException());
                }
            });

            ConfigurableApplicationContext context = app.run(args);
            
            // Register shutdown hook for graceful termination
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    logger.info("Initiating graceful shutdown of Workflow Service");
                    context.close();
                } catch (Exception e) {
                    logger.error("Error during application shutdown", e);
                }
            }));

            logger.info("Enhanced Prior Authorization Workflow Service started successfully");
            
        } catch (Exception e) {
            logger.error("Failed to start Workflow Service", e);
            System.exit(1);
        }
    }

    /**
     * Configures the async task executor for optimal performance.
     * 
     * @return AsyncTaskExecutor Configured thread pool executor
     */
    @Bean(name = "taskExecutor")
    public AsyncTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Configure thread pool
        executor.setCorePoolSize(CORE_POOL_SIZE);
        executor.setMaxPoolSize(MAX_POOL_SIZE);
        executor.setQueueCapacity(QUEUE_CAPACITY);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        
        // Configure rejection policy
        executor.setRejectedExecutionHandler((r, e) -> {
            logger.warn("Task rejected due to thread pool exhaustion");
            throw new RuntimeException("Workflow service task queue full");
        });
        
        // Configure thread monitoring
        executor.setThreadFactory(r -> {
            Thread thread = new Thread(r);
            thread.setUncaughtExceptionHandler((t, e) -> 
                logger.error("Uncaught exception in thread {}: {}", t.getName(), e.getMessage(), e)
            );
            return thread;
        });

        // Initialize the executor
        executor.initialize();
        
        logger.info("Configured async task executor with core pool size: {}, max pool size: {}", 
                   CORE_POOL_SIZE, MAX_POOL_SIZE);
        
        return executor;
    }

    /**
     * Cleanup method to ensure graceful shutdown of resources.
     */
    @PreDestroy
    public void onShutdown() {
        logger.info("Initiating workflow service shutdown sequence");
        
        try {
            if (applicationContext != null) {
                ThreadPoolTaskExecutor executor = 
                    applicationContext.getBean("taskExecutor", ThreadPoolTaskExecutor.class);
                
                executor.shutdown();
                if (!executor.getThreadPoolExecutor().awaitTermination(60, TimeUnit.SECONDS)) {
                    logger.warn("Thread pool did not terminate gracefully within 60 seconds");
                    executor.getThreadPoolExecutor().shutdownNow();
                }
            }
        } catch (Exception e) {
            logger.error("Error during workflow service shutdown", e);
        }
    }
}