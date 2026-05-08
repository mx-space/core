import { forwardRef, Inject, Module, OnModuleInit } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { ConfigsModule } from '../configs/configs.module'
import { EnrichmentController } from './enrichment.controller'
import { EnrichmentRepository } from './enrichment.repository'
import { EnrichmentService } from './enrichment.service'
import { ArxivProvider } from './providers/arxiv/arxiv.provider'
import { BangumiProvider } from './providers/bangumi/bangumi.provider'
// Providers
import { GitHubClient } from './providers/github/github.client'
import { GitHubCommitProvider } from './providers/github/github-commit.provider'
import { GitHubDiscussionProvider } from './providers/github/github-discussion.provider'
import { GitHubIssueProvider } from './providers/github/github-issue.provider'
import { GitHubPrProvider } from './providers/github/github-pr.provider'
import { GitHubRepoProvider } from './providers/github/github-repo.provider'
import { LeetcodeProvider } from './providers/leetcode/leetcode.provider'
import { NeoDBBookProvider } from './providers/neodb/neodb-book.provider'
import { NeteaseMusicProvider } from './providers/netease/netease-music.provider'
import { OpenGraphProvider } from './providers/open-graph/open-graph.provider'
import type { EnrichmentProvider } from './providers/provider.interface'
import { ProviderRegistry } from './providers/provider.registry'
import { QQMusicProvider } from './providers/qq/qq-music.provider'
import { MxSpaceProvider } from './providers/self/mx-space.provider'
import { TmdbClient } from './providers/tmdb/tmdb.client'
import { TmdbProvider } from './providers/tmdb/tmdb.provider'
import { UrlExtractorService } from './url-extractor.service'

const allProviders = [
  // Clients
  GitHubClient,
  TmdbClient,
  // GitHub
  GitHubRepoProvider,
  GitHubCommitProvider,
  GitHubIssueProvider,
  GitHubPrProvider,
  GitHubDiscussionProvider,
  // TMDB
  TmdbProvider,
  // Others
  BangumiProvider,
  NeoDBBookProvider,
  ArxivProvider,
  LeetcodeProvider,
  NeteaseMusicProvider,
  QQMusicProvider,
  MxSpaceProvider,
  OpenGraphProvider,
]

@Module({
  imports: [ConfigsModule, forwardRef(() => AiModule)],
  controllers: [EnrichmentController],
  providers: [
    EnrichmentRepository,
    EnrichmentService,
    ProviderRegistry,
    UrlExtractorService,
    ...allProviders,
  ],
  exports: [EnrichmentService, UrlExtractorService],
})
export class EnrichmentModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistry,
    @Inject(GitHubRepoProvider) private readonly ghRepo: GitHubRepoProvider,
    @Inject(GitHubCommitProvider)
    private readonly ghCommit: GitHubCommitProvider,
    @Inject(GitHubIssueProvider) private readonly ghIssue: GitHubIssueProvider,
    @Inject(GitHubPrProvider) private readonly ghPr: GitHubPrProvider,
    @Inject(GitHubDiscussionProvider)
    private readonly ghDiscussion: GitHubDiscussionProvider,
    @Inject(TmdbProvider) private readonly tmdb: TmdbProvider,
    @Inject(BangumiProvider) private readonly bangumi: BangumiProvider,
    @Inject(NeoDBBookProvider) private readonly neodb: NeoDBBookProvider,
    @Inject(ArxivProvider) private readonly arxiv: ArxivProvider,
    @Inject(LeetcodeProvider) private readonly leetcode: LeetcodeProvider,
    @Inject(NeteaseMusicProvider)
    private readonly netease: NeteaseMusicProvider,
    @Inject(QQMusicProvider) private readonly qq: QQMusicProvider,
    @Inject(MxSpaceProvider) private readonly mxSpace: MxSpaceProvider,
    @Inject(OpenGraphProvider) private readonly openGraph: OpenGraphProvider,
  ) {}

  onModuleInit() {
    const providers: EnrichmentProvider[] = [
      this.ghRepo,
      this.ghCommit,
      this.ghIssue,
      this.ghPr,
      this.ghDiscussion,
      this.tmdb,
      this.bangumi,
      this.neodb,
      this.arxiv,
      this.leetcode,
      this.netease,
      this.qq,
      this.mxSpace,
      this.openGraph,
    ]
    for (const provider of providers) {
      this.registry.register(provider)
    }
  }
}
