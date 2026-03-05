import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'sc-upload',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="upload-page">
      <h1>Upload Track</h1>

      <div class="upload-page__dropzone" (click)="fileInput.click()" [class.has-file]="selectedFile()">
        <input #fileInput type="file" accept="audio/*" (change)="onFileChange($event)" hidden>
        @if (selectedFile()) {
          <p>🎵 {{ selectedFile()!.name }}</p>
          <p style="color:var(--color-text-secondary);font-size:12px">{{ formatSize(selectedFile()!.size) }}</p>
        } @else {
          <p>Tap to select an audio file</p>
          <p style="color:var(--color-text-secondary);font-size:12px">MP3, WAV, FLAC — max 50MB</p>
        }
      </div>

      @if (uploadProgress() > 0 && uploadProgress() < 100) {
        <mat-progress-bar mode="determinate" [value]="uploadProgress()" />
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Genre (optional)</mat-label>
          <input matInput formControlName="genre" placeholder="e.g. Hip-Hop, Trap, Afrobeat">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>BPM (optional)</mat-label>
          <input matInput type="number" formControlName="bpm">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tags (comma-separated)</mat-label>
          <input matInput formControlName="tags" placeholder="dark, 808, melodic">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>

        @if (error()) { <p class="error">{{ error() }}</p> }

        <button mat-flat-button color="primary" type="submit" [disabled]="!selectedFile() || form.invalid">
          @if (uploadProgress() > 0 && uploadProgress() < 100) { Uploading... } @else { Publish Track }
        </button>
      </form>
    </div>
  `,
  styles: [`
    .upload-page { padding: 16px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 20px; }
    .upload-page__dropzone {
      border: 2px dashed var(--color-border); border-radius: var(--radius-card);
      padding: 32px; text-align: center; cursor: pointer; margin-bottom: 16px;
      &:hover, &.has-file { border-color: var(--color-accent-primary); }
      p { margin: 4px 0; }
    }
    .form { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    mat-form-field { width: 100%; }
    button { height: 48px; }
    .error { color: var(--color-accent-hot); font-size: 13px; }
  `],
})
export class UploadComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private router = inject(Router);

  form = this.fb.group({
    title: ['', Validators.required],
    genre: [''],
    bpm: [null as number | null],
    tags: [''],
    description: [''],
  });

  selectedFile = signal<File | null>(null);
  uploadProgress = signal(0);
  uploadedUrl = signal<string | null>(null);
  uploadedPublicId = signal<string | null>(null);
  error = signal('');

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { this.error.set('File too large — max 50MB'); return; }
    this.selectedFile.set(file);
    this._uploadToCloudinary(file);
  }

  private _uploadToCloudinary(file: File) {
    this.api.get<any>('/tracks/upload-params').subscribe(params => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', params.api_key);
      fd.append('timestamp', String(params.timestamp));
      fd.append('signature', params.signature);
      fd.append('folder', params.folder);
      fd.append('resource_type', 'video');

      const cloudUrl = `https://api.cloudinary.com/v1_1/${params.cloud_name}/video/upload`;
      const req = new XMLHttpRequest();
      req.upload.addEventListener('progress', e => {
        if (e.lengthComputable) this.uploadProgress.set(Math.round((e.loaded / e.total) * 100));
      });
      req.addEventListener('load', () => {
        const res = JSON.parse(req.responseText);
        this.uploadedUrl.set(res.secure_url);
        this.uploadedPublicId.set(res.public_id);
        this.uploadProgress.set(100);
      });
      req.open('POST', cloudUrl);
      req.send(fd);
    });
  }

  submit() {
    if (!this.uploadedUrl() || this.form.invalid) return;
    const v = this.form.value;
    const tags = (v.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
    this.api.post<any>('/tracks/', {
      title: v.title, description: v.description || null, genre: v.genre || null,
      bpm: v.bpm || null, cloudinary_public_id: this.uploadedPublicId()!,
      audio_url: this.uploadedUrl()!, tags,
    }).subscribe({
      next: track => this.router.navigate(['/tracks', track.id]),
      error: err => this.error.set(err.error?.detail ?? 'Upload failed'),
    });
  }

  formatSize(bytes: number): string { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
}
