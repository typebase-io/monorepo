import { type Files, type FilesHooks, type FilesPlugin, type UrlOptions } from 'files-sdk';

export type BucketOperation = 'upload' | 'download' | 'head' | 'exists' | 'delete' | 'copy' | 'move' | 'list' | 'listAll' | 'search';

export const BUCKET_OPERATIONS: readonly BucketOperation[] = [
  'upload',
  'download',
  'head',
  'exists',
  'delete',
  'copy',
  'move',
  'list',
  'listAll',
  'search',
];

export type Bucket = Pick<Files, BucketOperation>;

export type BucketAccess = 'public' | 'private';

export type SignedUrlOptions = Pick<UrlOptions, 'expiresIn' | 'responseContentDisposition'>;

export type PublicBucket = Bucket &
  Pick<Files, 'signedUploadUrl'> & {
    publicUrl: (key: string) => Promise<string>;
  };

export type PrivateBucket = Bucket &
  Pick<Files, 'signedUploadUrl'> & {
    signedUrl: (key: string, options?: SignedUrlOptions) => Promise<string>;
  };

export type AccessBucket<TOptions> = TOptions extends { access: 'public' } ? PublicBucket : PrivateBucket;

export interface FilesBucketOptions {
  prefix?: string;
  plugins?: readonly FilesPlugin[];
  hooks?: FilesHooks;
}

export interface AccessBucketOptions extends FilesBucketOptions {
  access: BucketAccess;
}
