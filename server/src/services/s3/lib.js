import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export class S3 {
  constructor(options) {
    this.bucket = options.bucket_name;
    this.client = new S3Client({
      credentials: {
        accessKeyId: options.access_key_id,
        secretAccessKey: options.secret_access_key,
      },
      region: options.bucket_region,
    });
  }

  remove(handle) {
    return this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: handle }));
  }

  store(id, buffer, contentType) {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: id,
        Body: buffer,
        ContentType: contentType,
      },
    });
    return upload.done().then(() => id);
  }

  async serve(handle, start, end) {
    const range = start === null && end === null
      ? 'bytes=0-'
      : `bytes=${start ?? ''}-${end ?? ''}`;

    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: handle,
      Range: range,
    }));

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

export default function createS3(options) {
  return new S3(options);
}
