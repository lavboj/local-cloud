package com.lavboj.local_cloud.service;

import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.stereotype.Service;

@Service
public class StorageService {

    private final Path rootPath = Paths.get("storage");

}
