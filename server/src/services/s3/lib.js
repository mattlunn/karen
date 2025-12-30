import AwsS3Client from 'aws-sdk/clients/s3';

export class S3 {
  constructor(options) {
    this.client = new AwsS3Client({
      apiVersion: '2006-03-01',
      accessKeyId: options.access_key_id,
      secretAccessKey: options.secret_access_key,
      sslEnabled: true,
      params: {
        Bucket: options.bucket_name
      },
      region: options.bucket_region
    });
  }

  remove(handle) {
    return new Promise((resolve, reject) => {
      this.client.deleteObject({ Key: handle }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  store(id, buffer, contentType) {
    return new Promise((resolve, reject) => {
      this.client.upload(
        {
          Body: buffer,
          ContentType: contentType,
          Key: id
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(id);
          }
        }
      );
    });
  }

  serve(handle, start, end) {
    let range;

    if (start === null && end === null) {
      range = '0-';
    } else {
      range = (start === null ? '' : start) + '-' + (end === null ? '' : end);
    }

    return new Promise((resolve, reject) => {
      this.client.getObject({ Key: handle, Range: 'bytes=' + range }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.Body);
        }
      });
    });
  }
}

export default function createS3(options) {
  return new S3(options);
}