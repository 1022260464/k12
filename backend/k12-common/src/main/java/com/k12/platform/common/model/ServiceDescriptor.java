package com.k12.platform.common.model;

import java.util.List;

public record ServiceDescriptor(String code, String name, String responsibility, List<String> capabilities) {
}
