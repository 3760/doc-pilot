package com.docpilot.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * 健康检查端点.
 *
 * <p>用于验证服务是否启动。MVP 阶段先用基础端点，后续会扩展：
 * <ul>
 *   <li>GET /api/v1/health - 服务健康</li>
 *   <li>GET /api/v1/health/ready - 就绪检查（DB 连接等）</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    /**
     * 基础健康检查.
     *
     * @return 包含状态、版本、时间戳的响应
     */
    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
            "status", "UP",
            "service", "docpilot-server",
            "version", "0.1.0-SNAPSHOT",
            "timestamp", Instant.now().toString()
        );
    }
}
