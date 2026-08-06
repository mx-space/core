import Foundation
import Testing

@testable import SpaceCore

/// Pins the create response against a body captured from a live instance —
/// the post path is what the composer depends on to dismiss itself.
@Suite struct RecentlyCreateDecodingTests {
    private static let captured = #"{"data":{"id":"166624431119036416","content":"decode probe","type":"text","metadata":null,"ref_type":null,"ref_id":null,"comments_index":0,"allow_comment":true,"up":0,"down":0,"created_at":"2026-08-04T19:06:00.111Z","modified_at":null,"enrichments":{}}}"#

    /// The create response for an isolated link comes back already hydrated,
    /// so it exercises the enrichment shape too — this is the body the composer
    /// must decode before it can dismiss.
    @Test func decodesACreateResponseCarryingAnEnrichment() async throws {
        let captured = "{\"data\":{\"id\":\"166624731460562944\",\"content\":\"probe2\\n\\nhttps://bgm.tv/subject/265\\n\\ntail\",\"type\":\"link\",\"metadata\":null,\"ref_type\":null,\"ref_id\":null,\"comments_index\":0,\"allow_comment\":true,\"up\":0,\"down\":0,\"created_at\":\"2026-08-04T19:07:11.718Z\",\"modified_at\":null,\"enrichments\":{\"https://bgm.tv/subject/265\":{\"url\":\"https://bgm.tv/subject/265\",\"title\":\"新世紀エヴァンゲリオン\",\"subtype\":\"subject\",\"category\":\"media\",\"fetched_at\":\"2026-08-04T18:28:07.821Z\",\"attributes\":[{\"key\":\"rating\",\"label\":\"Rating\",\"value\":8.7,\"format\":\"rating\"},{\"key\":\"votes\",\"label\":\"Votes\",\"value\":34034,\"format\":\"number\"}],\"description\":\"　　2000年，一个科学探险队在南极洲针对被称作“第一使徒”亚当的“光之巨人”进行探险。在对其进行接触实验时，“光之巨人”自毁，从而发生了“第二次冲击”，进而导致世界大战。最后，人类人口减半，地轴偏转、气候改变。根据对“第二次冲击”的调查，联合国在日本箱根成立人工进化研究所（即 GEHIRN）从事EVA（指机器人）的发展研究，后GEHIRN利用在人工进化研究所下方发现的巨大空洞建造了总部。\\r\\n　　另一方面，联合国下属秘密组织SEELE为了使人类进化，开始实行人类补完计划，就是将所有人的灵魂汇集在一起，通过中和每个人的AT力场，使每个人回归LCL之海。\\r\\n　　2004年，EVA初号机进行启动试验时发生事故，碇真嗣的母亲碇唯消失，碇源渡开始执行“碇源渡版本的人类补完计划”。2010年，GEHIRN被改建成NERV。\\r\\n　　2015年开始，根据SEELE人类补完计划剧本的安排，一种巨型人形生物“使徒”开始在日本登陆，并向NERV总部进攻，NERV组织EVA消灭使徒。在NERV与使徒作战的同时，碇源渡秘密地执行它自己的计划。随着时间推移，碇源渡的计划逐渐被SEELE发现，NERV与SEELE产\",\"published_at\":\"1995-10-04\",\"thumbnail_image\":{\"alt\":\"新世紀エヴァンゲリオン\",\"url\":\"https://lain.bgm.tv/pic/cover/l/e5/69/265_Z5Uou.jpg\"}}}}}"
        let transport = StubTransport([.init(status: .created, json: captured)])
        let service = RecentlyService(
            client: Client(
                serverURL: URL(string: "https://mx.example.com/api/v3")!,
                configuration: SpaceClient.configuration,
                transport: transport
            )
        )

        let entry = try await service.create(content: "probe2")
        #expect(entry.enrichments?.additionalProperties.count == 1)
    }

    @Test func decodesTheLiveCreateResponse() async throws {
        let transport = StubTransport([.init(status: .created, json: Self.captured)])
        let service = RecentlyService(
            client: Client(
                serverURL: URL(string: "https://mx.example.com/api/v3")!,
                configuration: SpaceClient.configuration,
                transport: transport
            )
        )

        let entry = try await service.create(content: "decode probe")
        #expect(entry.id == "166624431119036416")
        #expect(entry.content == "decode probe")
    }
}
