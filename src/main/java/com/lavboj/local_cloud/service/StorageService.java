package com.lavboj.local_cloud.service;
import com.lavboj.local_cloud.model.FileItem;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

@Service
public class StorageService {

    private final Path rootPath = Paths.get("storage");

    public enum DirContent {
        EMPTY,
        FILES_ONLY,
        HAS_DIRECTORIES
    }

    public DirContent checkContent(Path dirPath) throws IOException {
        try (Stream<Path> items = Files.list(dirPath)) {
            boolean hasFiles = false;
            boolean hasDirectories = false;

            for (Path item : items.toList()) {
                if (Files.isDirectory(item)) hasDirectories = true;
                else if (Files.isRegularFile(item)) hasFiles = true;
            }

            if (!hasFiles && !hasDirectories) return DirContent.EMPTY;
            else if (!hasFiles && hasDirectories) return DirContent.HAS_DIRECTORIES;
            return DirContent.FILES_ONLY;
        }
    }

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

    public void createDirectory(String userPath, String directoryName) throws IOException {
        Path currentPath = rootPath.resolve(userPath).normalize();
        Path newDirPath = currentPath.resolve(directoryName).normalize();

        if (!currentPath.startsWith(rootPath) || !newDirPath.startsWith(rootPath)) {
            throw new IllegalArgumentException("Access to the specified path is not allowed.");
        }

        if (!Files.exists(newDirPath)) {
            Files.createDirectories(newDirPath);
            return;
        } else  if (Files.isDirectory(newDirPath)) {
            throw new IllegalArgumentException("Directory already exists");
        } else {
            throw new IllegalArgumentException("This name is already in use for file");
        }
    }

    public void deleteDirectory(String userPath, String directoryName, boolean confirmed) throws IOException {
        Path targetPath = rootPath.resolve(userPath).resolve(directoryName).normalize();

        if(!targetPath.startsWith(rootPath)) {
            throw new IllegalArgumentException("Access to the specified path is not allowed.");
        }

        if (!Files.exists(targetPath) || !Files.isDirectory(targetPath)) {
            throw new NoSuchFileException("Directory does not exist: " + targetPath);
        }

        if(checkContent(targetPath).equals(DirContent.EMPTY)) {
            Files.delete(targetPath);
        } else if(confirmed) {
            Files.walkFileTree(targetPath, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }
                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException e) throws IOException{
                    if (e == null) {
                        Files.delete(dir);
                        return FileVisitResult.CONTINUE;
                    } else {
                        throw e;
                    }
                }});
        } else {
            throw new IllegalStateException("Directory is not empty, confirmation required to delete.");
        }
    }
}
