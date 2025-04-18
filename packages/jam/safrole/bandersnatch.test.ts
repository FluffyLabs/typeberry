import assert from "node:assert";
import { describe, it } from "node:test";

import { BANDERSNATCH_KEY_BYTES, BANDERSNATCH_PROOF_BYTES, BANDERSNATCH_RING_ROOT_BYTES, tryAsValidatorIndex } from "@typeberry/block";
import { SignedTicket, TicketAttempt, tryAsTicketAttempt } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { getRingCommitment, verifyTickets } from "./bandersnatch";
import { BandernsatchWasm } from "./bandersnatch-wasm";

const bandersnatch = BandernsatchWasm.new({ synchronous: true });

const attempt = (v: number) => tryAsTicketAttempt(v);

describe("Bandersnatch verification", () => {
  describe("getRingCommitment", () => {
    const bandersnatchKeys = asKnownSize(
      [
        "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
        "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
        "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
        "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
        "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
        "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
      ].map((x) => Bytes.parseBytes(x, BANDERSNATCH_KEY_BYTES).asOpaque()),
    );

    it("should return commitment", async () => {
      const result = await getRingCommitment(await bandersnatch, bandersnatchKeys);
      const expectedCommitment = Bytes.parseBytes(
        "0xb3750bba87e39fb38579c880ff3b5c4e0aa90df8ff8be1ddc5fdd615c6780955f8fd85d99fd92a3f1d4585eb7ae8d627b01dd76d41720d73c9361a1dd2e830871155834c55db72de38fb875a9470faedb8cae54b34f7bfe196a9caca00c2911592e630ae2b14e758ab0960e372172203f4c9a41777dadd529971d7ab9d23ab29fe0e9c85ec450505dde7f5ac038274cf",
        BANDERSNATCH_RING_ROOT_BYTES,
      );

      assert.strictEqual(result.isOk, true);
      assert.deepStrictEqual(result.ok, expectedCommitment);
    });
  });

  describe("verifyTickets", () => {
    const bandersnatchKeys = asKnownSize(
      [
        "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d",
        "0x3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0",
        "0xaa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc",
        "0x7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e33",
        "0x48e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3",
        "0xf16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
      ].map((x) => Bytes.parseBytes(x, BANDERSNATCH_KEY_BYTES).asOpaque()),
    );

    it("should confirm that all tickets are valid and return correct ids", async () => {
      const tickets: SignedTicket[] = [
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0xb342bf8f6fa69c745daad2e99c92929b1da2b840f67e5e8015ac22dd1076343eec00b574369c92536db6d65e5d6a3bc01fc8612cccbece4a32a8439e5ce646491be3b7b13eab6be3190eb57ddbde2a4c20472768563b12aa1e1b8b299cd41b8d2b566c14a7f8643a5d976ced0a18d12e32c660d59c66c271332138269cb0fe9c6707eb7821301ae4c172a9648036cf719fa2f64f272a008dd58f0734c00a440f7f5a457abb3c9271ffe61f8dc998ddda0499a783836b54e5b727f44a2eecb017b0341a1868fc476a0d6da019b5f2b4e521903b00e937f23b17ea49d6928c615841da5442e5b070079af6cdbbaed964a9b044dcf1ae69ce2e2febec37f6369910a0b20b9dce71b4cd3396e44a90a0a4c404cb170d7ffd2c5467f152bd5daf40b3b81e067e10509356f4b6e98a990c37346348d20fd47aab334c3acf2b51d58e63e0e5eecf84f646b0df292ee25b2d7267831b1ae29540a0604bc50f213f7c981752b740d026f8c4734de9c721f0fee4254053f763776a97e9b870d11e1a9c58b27db5b035b91c7276a18ed3654fb70b52a38b80503ba0cc88c53a04793bea963efdc3ae0e98fd0cda9330796ae9ca3d9795f4abe806978fab744e8c5659fb7469a5beb5bed213fdc1b036763c7f0d911627d43aa01340570c946e13d0951aa64d452fc7f7e842389fe25bd646d674931263656585c2f13336ff64a90674b0ae1df8b8a9f0fe28c8a049eaec1c788fde0d883958f9c08820751b9f9143bca8d656a12d28132eb81ebde2d21680cd0a6f589f9c8ebd2fe84917aa16492d91cf7f58aa92d1bb9b9905a88f8a9846637d77439641c33c9db9fe855ce5b532cbe00c6a828ee974f5918f970e106f2f60bc9cecebcf0a35a239934cbbb29f0ec99a412b247b54c96ac582b52179a8fae3a0f8956cfb6fc541902bef749a034a9a59cb08715fbed847592784097b2d20b923a14bb2f8319508341bf39b16b104199477680af2a7b2a2dcddba88963b64229e1a25ce8cb9f7fbdee49c6ecfb31751c7a237b46578030c7f0c5088d4b54ede07c1ecdc3730a07ff78ccd8c0a020cf494f5059f21802cb8f866a680854ce7162bfa8a",
          BANDERSNATCH_PROOF_BYTES).asOpaque(),
        },
        {
          attempt: attempt(2),
          signature: Bytes.parseBytes(
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d15b25ec30bb1c8857402a837ffcee3d01495a3140028473ab4cdb1fa2fed9f71f22309a4d59d411d8fbeb9dd5ab06d981dad3ad0e7859792d79dbdc7e055aabab891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6902d347383f957fe0a9bf6cf5399a43fd70bea1234072521d1e64acbce8de10affd6dc96ab1673ebd6e36e205eb4d0af54206583778499ddf25c59a25a1882008c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f8b37ab6773b166899f965d6b2ffca0f85017a295d680359230823b3c3d91e9e7167ef4a579990035e4ad5e257dc1597ca01b77cba029dea7e18449fc9a31e684cb462dcc3612c169ae2a295993efb8b0a9196825f9bc3be736ba8be970e3b3c3c257ab5d8686066ecd2ee5e51f8095b655c1f8415bd6589c1f20528af4a8402323f7f76fbe5a72955ecb08a97dd7e93913fad39ebf7fddf65d8e5f1f4327a516dca6856b0a741645d4102188cd16c136ce3bb59075174174091e3b2d525aec5c7bcafa2e11017216b8c86108c38038ea0066690a36e6363470809ca38c594b61413a2d8b7b1a141587f608fb03fbdced6999bcbb11074dcdc34ea6b42028a671c786b7e2e36f12e143f4cc1282c0ea47a013c62d084a2f9322e20f6fb49c2449682d5fde30e895bc2a3f09afe5fd79879748624a37a79de0be419dbc8073e750845210897c364af4f007ee877e1f1214d18aa7d0b688e87cfe42adfbc6600bbcdd08001252b0bac47a3127098b4701313ed65ec54dd6158abdc23d4c92ec20c91b78b458bcd5d2f0e352bb0bb315ae47a8ce5a879dbd249ec5f35e9b8cacde14eac8c6383463b0ca7637306d547894b29fada8d0b7bb3b8dcbd1457ce5092059b9b3a8c0dca0d5db44f01f937292cede604c5526bdbe780e5029fb90ee2a7e7b2a903a8ce7d7be8d7139ba448f683d1c",
            BANDERSNATCH_PROOF_BYTES
          ).asOpaque(),
        },
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0x8e6eb88b02110c941451eef7da84e65bafaefcec1b1a5640ad579425e4a7e3ee5b4c2e5450ec6f28e6d3df3e5053be8d62ec3e747a07cc3a6d79261f27b5273009683feb1d245654ae63def9b9acf58319d5b29ee06f8320384e5159d5518301a8b4b304c09306a65e8720633d53bfa3f663bb2c0c53fbb12131828de1c53ce3d7f4f246bbee1ff781dfcc2dc72648df86ce95c26eef9e741c36462524f87b05ea21c2282ee16fc0e5ecab17e44e4da2c798c7b3ae0e5c6900a3cf6b34d4e908948c0ac0e7c8105139b896fd31b08747cbd53175bce1bf2e6802ee47c2e71a3615e16a6d12c0066c7b9d99db4daaa3fa8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7fab655b1734cf497f9f1eee88206725753f458ec179b7fe13fd716398c99fe8625c0b5d927bbe57ec27c0cd3d13b0814e96320a0a6544cd8acda84652b36e890bf1f7a9e58bd6b38594927fa9a0e0dcaf28536367bb23b02e3cf6e956fef877167429029330ea32a91625a696a0dfe07595b94604217e81f4c09965eb37d7893efa301dcb080287f030d21eb8d1d1a4809f862b4ff27f55d39d250acb16e77a57ba22eabab8a6aaacda645b0ba77e0a8122bfb7460e19d2380744a0ad229d2302330aebd3ba74cccef6491ed008b091c87865794dc53f72a7d2c510f38140365619da062dcd29d690458a09f48376a93518939af0769a8c9f6c16b1712e7212313d80993eaca25e4be20d54407613ea2002eb52b945d9d4763eea2f7bf0c2ae3e48ee17e9c5cd084bc4445ac5b30dc788f7a542390a25ccab38f18c47c242e9348053ca1f34fc6e242250cc129574e368849945718f368a663f446b37a7780d31b27cb2cc16d0dd29e9c862c3696df5ae1b5de7500bdb4ec8f3eecac51a1c08f6c5a34855e9daa172c7335f539d463135b0efc1e7ad27afe2eea3f2f938e38300fde5013abfa966d6cabc211147edcfbd53989e552fa5c25b9c4fd4cb94fa4ff08c6fba11fbfe25eef500d3e43152bebcfb813ba33e285702a00a843f920b807c199a47e6b231440a02edf8fd793af8db",
          BANDERSNATCH_PROOF_BYTES).asOpaque(),
        },
      ];

      const entropy = Bytes.parseBytes(
        "0xbb30a42c1e62f0afda5f0a4e8a562f7a13a24cea00ee81917b86b89e801314aa",
        HASH_SIZE,
      ).asOpaque();
      const expectedIds = [
        "0x09a696b142112c0af1cd2b5f91726f2c050112078e3ef733198c5f43daa20d2b",
        "0x13fecb426e0a73b84b58b9a0832b11582dc971e79c5399e69f0baf1a244c7787",
        "0x3a5d10abc80dda33fe3f40b3bb2e3eefd3e97dda3d617a860c9d94eb70b832ad",
      ].map((x) => Bytes.parseBytes(x, HASH_SIZE));

      const result = await verifyTickets(await bandersnatch, bandersnatchKeys, tickets, entropy);

      assert.strictEqual(
        result.every((x) => x.isValid),
        true,
      );
      assert.deepStrictEqual(
        result.map((x) => x.entropyHash),
        expectedIds,
      );
    });

    it("should detect that one signature is incorrect", async () => {
      const tickets = [
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d15b25ec30bb1c8857402a837ffcee3d01495a3140028473ab4cdb1fa2fed9f71f22309a4d59d411d8fbeb9dd5ab06d981dad3ad0e7859792d79dbdc7e055aabab891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6902d347383f957fe0a9bf6cf5399a43fd70bea1234072521d1e64acbce8de10affd6dc96ab1673ebd6e36e205eb4d0af54206583778499ddf25c59a25a1882008c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f8b37ab6773b166899f965d6b2ffca0f85017a295d680359230823b3c3d91e9e7167ef4a579990035e4ad5e257dc1597ca01b77cba029dea7e18449fc9a31e684cb462dcc3612c169ae2a295993efb8b0a9196825f9bc3be736ba8be970e3b3c3c257ab5d8686066ecd2ee5e51f8095b655c1f8415bd6589c1f20528af4a8402323f7f76fbe5a72955ecb08a97dd7e93913fad39ebf7fddf65d8e5f1f4327a516dca6856b0a741645d4102188cd16c136ce3bb59075174174091e3b2d525aec5c7bcafa2e11017216b8c86108c38038ea0066690a36e6363470809ca38c594b61413a2d8b7b1a141587f608fb03fbdced6999bcbb11074dcdc34ea6b42028a671c786b7e2e36f12e143f4cc1282c0ea47a013c62d084a2f9322e20f6fb49c2449682d5fde30e895bc2a3f09afe5fd79879748624a37a79de0be419dbc8073e750845210897c364af4f007ee877e1f1214d18aa7d0b688e87cfe42adfbc6600bbcdd08001252b0bac47a3127098b4701313ed65ec54dd6158abdc23d4c92ec20c91b78b458bcd5d2f0e352bb0bb315ae47a8ce5a879dbd249ec5f35e9b8cacde14eac8c6383463b0ca7637306d547894b29fada8d0b7bb3b8dcbd1457ce5092059b9b3a8c0dca0d5db44f01f937292cede604c5526bdbe780e5029fb90ee2a7e7b2a903a8ce7d7be8d7139ba448f683d1c",
          BANDERSNATCH_PROOF_BYTES).asOpaque(),
        },
        {
          attempt: attempt(2),
          signature: Bytes.parseBytes(
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d15b25ec30bb1c8857402a837ffcee3d01495a3140028473ab4cdb1fa2fed9f71f22309a4d59d411d8fbeb9dd5ab06d981dad3ad0e7859792d79dbdc7e055aabab891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6902d347383f957fe0a9bf6cf5399a43fd70bea1234072521d1e64acbce8de10affd6dc96ab1673ebd6e36e205eb4d0af54206583778499ddf25c59a25a1882008c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f8b37ab6773b166899f965d6b2ffca0f85017a295d680359230823b3c3d91e9e7167ef4a579990035e4ad5e257dc1597ca01b77cba029dea7e18449fc9a31e684cb462dcc3612c169ae2a295993efb8b0a9196825f9bc3be736ba8be970e3b3c3c257ab5d8686066ecd2ee5e51f8095b655c1f8415bd6589c1f20528af4a8402323f7f76fbe5a72955ecb08a97dd7e93913fad39ebf7fddf65d8e5f1f4327a516dca6856b0a741645d4102188cd16c136ce3bb59075174174091e3b2d525aec5c7bcafa2e11017216b8c86108c38038ea0066690a36e6363470809ca38c594b61413a2d8b7b1a141587f608fb03fbdced6999bcbb11074dcdc34ea6b42028a671c786b7e2e36f12e143f4cc1282c0ea47a013c62d084a2f9322e20f6fb49c2449682d5fde30e895bc2a3f09afe5fd79879748624a37a79de0be419dbc8073e750845210897c364af4f007ee877e1f1214d18aa7d0b688e87cfe42adfbc6600bbcdd08001252b0bac47a3127098b4701313ed65ec54dd6158abdc23d4c92ec20c91b78b458bcd5d2f0e352bb0bb315ae47a8ce5a879dbd249ec5f35e9b8cacde14eac8c6383463b0ca7637306d547894b29fada8d0b7bb3b8dcbd1457ce5092059b9b3a8c0dca0d5db44f01f937292cede604c5526bdbe780e5029fb90ee2a7e7b2a903a8ce7d7be8d7139ba448f683d1c",
          BANDERSNATCH_PROOF_BYTES).asOpaque(),
        },
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0x8e6eb88b02110c941451eef7da84e65bafaefcec1b1a5640ad579425e4a7e3ee5b4c2e5450ec6f28e6d3df3e5053be8d62ec3e747a07cc3a6d79261f27b5273009683feb1d245654ae63def9b9acf58319d5b29ee06f8320384e5159d5518301a8b4b304c09306a65e8720633d53bfa3f663bb2c0c53fbb12131828de1c53ce3d7f4f246bbee1ff781dfcc2dc72648df86ce95c26eef9e741c36462524f87b05ea21c2282ee16fc0e5ecab17e44e4da2c798c7b3ae0e5c6900a3cf6b34d4e908948c0ac0e7c8105139b896fd31b08747cbd53175bce1bf2e6802ee47c2e71a3615e16a6d12c0066c7b9d99db4daaa3fa8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7fab655b1734cf497f9f1eee88206725753f458ec179b7fe13fd716398c99fe8625c0b5d927bbe57ec27c0cd3d13b0814e96320a0a6544cd8acda84652b36e890bf1f7a9e58bd6b38594927fa9a0e0dcaf28536367bb23b02e3cf6e956fef877167429029330ea32a91625a696a0dfe07595b94604217e81f4c09965eb37d7893efa301dcb080287f030d21eb8d1d1a4809f862b4ff27f55d39d250acb16e77a57ba22eabab8a6aaacda645b0ba77e0a8122bfb7460e19d2380744a0ad229d2302330aebd3ba74cccef6491ed008b091c87865794dc53f72a7d2c510f38140365619da062dcd29d690458a09f48376a93518939af0769a8c9f6c16b1712e7212313d80993eaca25e4be20d54407613ea2002eb52b945d9d4763eea2f7bf0c2ae3e48ee17e9c5cd084bc4445ac5b30dc788f7a542390a25ccab38f18c47c242e9348053ca1f34fc6e242250cc129574e368849945718f368a663f446b37a7780d31b27cb2cc16d0dd29e9c862c3696df5ae1b5de7500bdb4ec8f3eecac51a1c08f6c5a34855e9daa172c7335f539d463135b0efc1e7ad27afe2eea3f2f938e38300fde5013abfa966d6cabc211147edcfbd53989e552fa5c25b9c4fd4cb94fa4ff08c6fba11fbfe25eef500d3e43152bebcfb813ba33e285702a00a843f920b807c199a47e6b231440a02edf8fd793af8db",
          BANDERSNATCH_PROOF_BYTES).asOpaque(),
        },
      ];

      const entropy = Bytes.parseBytes(
        "0xbb30a42c1e62f0afda5f0a4e8a562f7a13a24cea00ee81917b86b89e801314aa",
        HASH_SIZE,
      ).asOpaque();
      const expectedIds = [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        "0x13fecb426e0a73b84b58b9a0832b11582dc971e79c5399e69f0baf1a244c7787",
        "0x3a5d10abc80dda33fe3f40b3bb2e3eefd3e97dda3d617a860c9d94eb70b832ad",
      ].map((x) => Bytes.parseBytes(x, HASH_SIZE));

      const result = await verifyTickets(await bandersnatch, bandersnatchKeys, tickets, entropy);

      assert.deepStrictEqual(
        result.map((x) => x.isValid),
        [false, true, true],
      );
      assert.deepStrictEqual(
        result.map((x) => x.entropyHash),
        expectedIds,
      );
    });
  });

  describe("verifySeal", () => {
    const keys = BytesBlob.parseBlob(
      "0x5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0aa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e3348e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3f16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d",
    );
    const authorIndex = tryAsValidatorIndex(4);

    it("should verify seal with some aux data", async () => {
      const signature = BytesBlob.parseBlob(
        "0xa060e079fdeefc27d1278b9a3d1922874c87e8d0dc7885d08443a29a460af82701bf291885c3c1d84f439688abb435ab1c5cf29baaa1cff157d2731ee748a005032620b6bdc3282b7dd8c54d0e71ad8577cdda0736841cff87394c4ab52d610e",
      );
      const payload = BytesBlob.parseBlob(
        "0x6a616d5f66616c6c6261636b5f7365616cd2d34655ebcad804c56d2fd5f932c575b6a5dbb3f5652c5202bcc75ab9c2cc95",
      );
      const auxData = BytesBlob.parseBlob(
        "0x476243ad7cc4fc49cb6cb362c6568e931731d8650d917007a6037cceedd6224499f227c2137bc71b415c18e4eb74c6450e575af3708d52cb40ea15dee1ce574a189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca2520c000000016f6ad2224d7d58aec6573c623ab110700eaca20a48dc2965d535e466d524af2a835ac82bfa2ce8390bb50680d4b7a73dfa2a4cff6d8c30694b24a605f9574eaf5e465beb01dbafe160ce8216047f2155dd0569f058afd52dcea601025a8d161d3d5e5a51aab2b048f8686ecd79712a80e3265a114cc73f14bdb2a59233fb66d0aa2b95f7572875b0d0f186552ae745ba8222fc0b5bd456554bfe51c68938f8bc7f6190116d118d643a98878e294ccf62b509e214299931aad8ff9764181a4e3348e5fcdce10e0b64ec4eebd0d9211c7bac2f27ce54bca6f7776ff6fee86ab3e3f16e5352840afb47e206b5c89f560f2611835855cf2e6ebad1acc9520a72591d000004004b213bfc74f65eb109896f1d57e78809d1a94c0c1b2e4543a9ee470eb6cfdfee96228bd01847dbe9e92c5c8c190fab85da4cb5ecd63cd3c758730b17b1247d1be6a5107ff246b08fbf8dcad39ba00b33e9ee4e2b934f62ee7e503e2a1eeaba11",
      );

      const result = await (await bandersnatch).verifySeal(
        keys.raw,
        authorIndex,
        signature.raw,
        payload.raw,
        auxData.raw,
      );

      assert.deepStrictEqual(
        BytesBlob.blobFrom(result).toString(),
        "0x001286e739f65659311c7f3380ec9afad3560bc2971a0ea1d0acc961d79c0cf4c4",
      );
    });

    it("should verify seal without aux data", async () => {
      const signature = BytesBlob.parseBlob(
        "0x4b213bfc74f65eb109896f1d57e78809d1a94c0c1b2e4543a9ee470eb6cfdfee96228bd01847dbe9e92c5c8c190fab85da4cb5ecd63cd3c758730b17b1247d1be6a5107ff246b08fbf8dcad39ba00b33e9ee4e2b934f62ee7e503e2a1eeaba11",
      );
      const payload = BytesBlob.parseBlob(
        "0x6a616d5f656e74726f70791286e739f65659311c7f3380ec9afad3560bc2971a0ea1d0acc961d79c0cf4c4",
      );
      const auxData = BytesBlob.parseBlob("0x");

      const result = await (await bandersnatch).verifySeal(
        keys.raw,
        authorIndex,
        signature.raw,
        payload.raw,
        auxData.raw,
      );

      assert.deepStrictEqual(
        BytesBlob.blobFrom(result).toString(),
        "0x00543054132a05c2710ac8fd0924810d3a8f7b7a7637c31a35cf6a05d54122529f",
      );
    });
  });
});
