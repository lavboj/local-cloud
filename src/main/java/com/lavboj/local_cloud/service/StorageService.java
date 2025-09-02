package com.lavboj.local_cloud.service;
import com.lavboj.local_cloud.model.FileItem;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
            return stream.map(path -> {
                try {
                    boolean isDir = Files.isDirectory(path);
                    long size = isDir ? 0 : Files.size(path);

                    BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
                    String modified = attrs.lastModifiedTime()
                            .toInstant()
                            .atZone(ZoneId.systemDefault())
                            .format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"));

                    return new FileItem(path.getFileName().toString(), isDir, size, modified);

                } catch (IOException e){
                    throw new RuntimeException("Ошибка при чтении атрибутов " + path, e);
                }
            }).collect(Collectors.toList());
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

    public Map<String, String> deleteFile(String userPath, List<String> listFileName) throws IOException {
        Map<String, String> result = new HashMap<>();
        for (String fileName : listFileName) {
            try {
                Path targetPath = rootPath.resolve(userPath).resolve(fileName).normalize();

                if(!targetPath.startsWith(rootPath)) {
                    result.put(fileName, "Error: Access to the specified path is not allowed.");
                    continue;
                }

                if(!Files.exists(targetPath) || Files.isDirectory(targetPath)) {
                    result.put(fileName, "Error: File does not exist");
                    continue;
                }
                
                Files.deleteIfExists(targetPath);
                result.put(fileName, "File was succesfully deleted");
            } catch (Exception e) {
                result.put(fileName, "Error: " + e.getMessage());
            }
        }
        return result;
    }

    public void uploadFile(String userPath, MultipartFile file) throws IOException {
        Path targetPath = rootPath.resolve(userPath).normalize();
        Path destinationFile = targetPath.resolve(Paths.get(file.getOriginalFilename())).normalize();

        if (!destinationFile.startsWith(rootPath)) {
            throw new IllegalArgumentException("Access to the specified path is not allowed.");
        }

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destinationFile, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public DownloadResource downloadFile(String userPath, String fileName) throws IOException {
        Path targetPath = rootPath.resolve(userPath).resolve(fileName).normalize();
        File file = targetPath.toFile();

        if (!file.exists()) throw new FileNotFoundException("File not found: " + fileName);

        String downloadName = fileName;
        Resource resource;

        if (file.isFile()) {
            resource = new InputStreamResource(new FileInputStream(file));
        }
        else {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(baos)){
                zipFolder(file, file.getName(), zos);
            }

            resource = new InputStreamResource(new ByteArrayInputStream(baos.toByteArray()));
            downloadName += ".zip";
        }

        return new DownloadResource(resource, downloadName);
    }

    public static class DownloadResource {
        private final Resource resource;
        private final String downloadName;

        public DownloadResource(Resource resource, String downloadName) {
            this.resource = resource;
            this.downloadName = downloadName;
        }

        public Resource getResource() {return this.resource;}
        public String getDownloadName() {return this.downloadName;}
    }

    private void zipFolder(File folder, String parentFolder, ZipOutputStream zos) throws IOException{
        for (File f : folder.listFiles()) {
            String entryName = parentFolder + "/" + f.getName();
            if (f.isDirectory()) {
                zipFolder(f, entryName, zos);
            } else {
                try (FileInputStream fis = new FileInputStream(f)) {
                    zos.putNextEntry(new ZipEntry(entryName));
                    fis.transferTo(zos);
                    zos.closeEntry();
                }
            }
        }
    }


}
