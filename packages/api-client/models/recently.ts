import type { BaseCommentIndexModel } from './base'

export enum RecentlyRefTypes {
  Post = 'Post',
  Note = 'Note',
  Page = 'Page',
}

export type RecentlyRefType = {
  title: string
  url: string
}

export enum RecentlyTypeEnum {
  Text = 'text',
  Book = 'book',
  Media = 'media',
  Music = 'music',
  Github = 'github',
  Link = 'link',
  Academic = 'academic',
  Code = 'code',
}

export interface BookMetadata {
  url: string
  title: string
  author: string
  cover?: string
  rating?: number
  isbn?: string
}

export interface MediaMetadata {
  url: string
  title: string
  originalTitle?: string
  cover?: string
  rating?: number
  description?: string
  genre?: string
}

export interface MusicMetadata {
  url: string
  title: string
  artist: string
  album?: string
  cover?: string
  source?: string
}

export interface GithubMetadata {
  url: string
  owner: string
  repo: string
  description?: string
  stars?: number
  language?: string
  languageColor?: string
}

export interface LinkMetadata {
  url: string
  title?: string
  description?: string
  image?: string
}

export interface AcademicMetadata {
  url: string
  title: string
  authors?: string[]
  arxivId?: string
}

export interface CodeMetadata {
  url: string
  title: string
  difficulty?: string
  tags?: string[]
  platform?: string
}

export type RecentlyMetadata =
  | BookMetadata
  | MediaMetadata
  | MusicMetadata
  | GithubMetadata
  | LinkMetadata
  | AcademicMetadata
  | CodeMetadata

export interface RecentlyModel extends BaseCommentIndexModel {
  content: string
  type: RecentlyTypeEnum
  metadata?: RecentlyMetadata

  ref?: RecentlyRefType & { [key: string]: any }
  refId?: string
  refType?: RecentlyRefTypes

  up: number
  down: number

  modified?: string
}
