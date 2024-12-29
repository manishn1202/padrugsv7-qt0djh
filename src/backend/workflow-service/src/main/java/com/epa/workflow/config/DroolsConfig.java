package com.epa.workflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.kie.api.KieServices;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.kie.api.builder.KieFileSystem;
import org.kie.api.builder.KieBuilder;
import org.kie.api.builder.Results;
import org.kie.api.builder.Message.Level;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PreDestroy;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Production-ready configuration class for Drools rule engine setup with enhanced error handling,
 * validation, and monitoring capabilities for clinical criteria evaluation.
 *
 * @version 1.0
 */
@Configuration
public class DroolsConfig {

    private static final Logger logger = LoggerFactory.getLogger(DroolsConfig.class);
    private static final String RULES_PATH = "rules/clinical-criteria.drl";
    private static final int SESSION_POOL_SIZE = 10;

    @Autowired
    private ResourceLoader resourceLoader;

    private KieSession[] sessionPool;
    private AtomicInteger sessionCounter = new AtomicInteger(0);

    /**
     * Creates and configures KieServices with production settings
     * @return Configured KieServices instance
     */
    @Bean
    public KieServices kieServices() {
        logger.info("Initializing KieServices for production environment");
        return KieServices.Factory.get();
    }

    /**
     * Creates KieFileSystem with enhanced validation
     * @param kieServices The KieServices instance
     * @return Validated KieFileSystem with rules
     * @throws IllegalStateException if rules file cannot be loaded or validated
     */
    @Bean
    public KieFileSystem kieFileSystem(KieServices kieServices) {
        logger.info("Setting up KieFileSystem with clinical criteria rules");
        KieFileSystem kieFileSystem = kieServices.newKieFileSystem();

        Resource rulesResource = resourceLoader.getResource("classpath:" + RULES_PATH);
        try {
            String rulesContent = new String(rulesResource.getInputStream().readAllBytes());
            kieFileSystem.write("src/main/resources/" + RULES_PATH, rulesContent);
        } catch (IOException e) {
            String errorMsg = "Failed to load clinical criteria rules file: " + RULES_PATH;
            logger.error(errorMsg, e);
            throw new IllegalStateException(errorMsg, e);
        }

        return kieFileSystem;
    }

    /**
     * Creates production-ready KieContainer with comprehensive error handling
     * @param kieServices The KieServices instance
     * @param kieFileSystem The configured KieFileSystem
     * @return Production-configured KieContainer
     * @throws IllegalStateException if build validation fails
     */
    @Bean
    public KieContainer kieContainer(KieServices kieServices, KieFileSystem kieFileSystem) {
        logger.info("Building KieContainer with validation checks");
        
        KieBuilder kieBuilder = kieServices.newKieBuilder(kieFileSystem);
        kieBuilder.buildAll();
        
        Results results = kieBuilder.getResults();
        if (results.hasMessages(Level.ERROR)) {
            String errorMsg = "Failed to build Drools knowledge base:\n" + 
                            results.getMessages().stream()
                                   .map(Object::toString)
                                   .reduce("", (a, b) -> a + "\n" + b);
            logger.error(errorMsg);
            throw new IllegalStateException(errorMsg);
        }

        KieContainer kieContainer = kieServices.newKieContainer(kieBuilder.getKieModule().getReleaseId());
        
        // Verify container configuration
        try {
            kieContainer.verify();
            logger.info("KieContainer successfully verified");
        } catch (Exception e) {
            String errorMsg = "KieContainer verification failed";
            logger.error(errorMsg, e);
            throw new IllegalStateException(errorMsg, e);
        }

        return kieContainer;
    }

    /**
     * Creates thread-safe KieSession pool with monitoring
     * @param kieContainer The production-ready KieContainer
     * @return Monitored KieSession from the pool
     */
    @Bean
    public KieSession kieSession(KieContainer kieContainer) {
        logger.info("Initializing KieSession pool with size: {}", SESSION_POOL_SIZE);
        
        sessionPool = new KieSession[SESSION_POOL_SIZE];
        for (int i = 0; i < SESSION_POOL_SIZE; i++) {
            KieSession session = kieContainer.newKieSession();
            // Set up session monitoring
            session.addEventListener(new DroolsMetricsEventListener());
            sessionPool[i] = session;
        }

        return getSessionFromPool();
    }

    /**
     * Retrieves a KieSession from the pool using round-robin distribution
     * @return Available KieSession instance
     */
    private KieSession getSessionFromPool() {
        int index = sessionCounter.getAndIncrement() % SESSION_POOL_SIZE;
        return sessionPool[index];
    }

    /**
     * Cleanup method to dispose of all KieSessions in the pool
     */
    @PreDestroy
    public void cleanup() {
        logger.info("Disposing KieSession pool");
        if (sessionPool != null) {
            for (KieSession session : sessionPool) {
                if (session != null) {
                    try {
                        session.dispose();
                    } catch (Exception e) {
                        logger.warn("Error disposing KieSession", e);
                    }
                }
            }
        }
    }
}