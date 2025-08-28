package com.lavboj.local_cloud.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {
    
    @GetMapping("/storage")
        public String storagePage() {
            return "index"; // ищет index.html в resources/templates
        }
}
