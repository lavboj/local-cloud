package com.lavboj.local_cloud.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lavboj.local_cloud.model.FileItem;
import com.lavboj.local_cloud.service.StorageService;

@RestController
@RequestMapping("/api/storage")
public class StorageController {

    private final StorageService storageService;

    public StorageController(StorageService storageService) {
        this.storageService = storageService;
    }

    @GetMapping("/content")
    public List<FileItem> getContent(@RequestParam(defaultValue = "") String userPath) throws IOException {
        return storageService.getContent(userPath);
    }

}
