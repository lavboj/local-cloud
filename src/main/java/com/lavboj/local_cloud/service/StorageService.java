package com.lavboj.local_cloud.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import com.lavboj.local_cloud.model.FileItem;

@Service
public class StorageService {

    private final Path rootPath = Paths.get("storage");

    public List<FileItem> getContent(String userPath) throws IOException{
        Path currentPath = rootPath.resolve(userPath).normalize();

        if (!currentPath.startsWith(rootPath)) {
            throw new IllegalArgumentException("Access to the specified path is not allowed.");
        }

        try (Stream<Path> stream = Files.list(currentPath)) {
            return stream
                .map(path -> new FileItem(path.getFileName().toString(), Files.isDirectory(path)))
                .collect(Collectors.toList());
        }
    }

}
