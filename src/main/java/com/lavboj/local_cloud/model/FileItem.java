package com.lavboj.local_cloud.model;

public class FileItem {
    private String name;
    private boolean isDirectory;
    private long size;
    private String modified;

    public FileItem(String name, boolean isDirectory, long size, String modified) {
        this.name = name;
        this.isDirectory = isDirectory;
        this.size = size;
        this.modified = modified;
    }

    public String getName() {
        return this.name;
    }

    public boolean isDirectory() {
        return this.isDirectory;
    }

    public long getSize() {
        return this.size;
    }

    public String getModified() {
        return this.modified;
    }
}
