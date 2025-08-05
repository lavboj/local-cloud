package com.lavboj.local_cloud.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lavboj.local_cloud.model.FileItem;
import com.lavboj.local_cloud.service.StorageService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


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

    @PostMapping("/create")
    public ResponseEntity<?> createDirectory(
            @RequestParam(defaultValue = "") String userPath,
            @RequestParam(required = true) String directoryName
    ){
        try {
            storageService.createDirectory(userPath, directoryName);
            return ResponseEntity.status(HttpStatus.CREATED).body("Creation was succesfull");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("This name is already in use");
        }
    }
    
    @DeleteMapping("/deleteDirectory")
    public ResponseEntity<?> deleteDirectory(
        @RequestParam(defaultValue = "") String userPath,
        @RequestParam(required = true) String directoryName,
        @RequestParam(name = "confirmed", defaultValue = "false") boolean confirmed
    ){
        try {
            storageService.deleteDirectory(userPath, directoryName, confirmed);
            return ResponseEntity.status(HttpStatus.OK).body("Deleting was succesfull");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Problem with deleting: " + e.getMessage());
        }
    }

    @DeleteMapping("/deleteFile")
    public ResponseEntity<Map<String, String>> deleteFile(
        @RequestParam(defaultValue = "") String userPath,
        @RequestBody(required = true) List<String> listFileName
    ){
        try {
            Map<String, String> result = storageService.deleteFile(userPath, listFileName);

            boolean hasErrors = result.values().stream()
                    .anyMatch(status -> status.startsWith("Error"));

            HttpStatus status = hasErrors ? HttpStatus.MULTI_STATUS : HttpStatus.OK;

            return ResponseEntity.status(status).body(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("Error:", e.getMessage()));
        }
    }
    
}
