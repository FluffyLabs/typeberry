import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsValidatorIndex } from "@typeberry/block";
import { type SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { BANDERSNATCH_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { BANDERSNATCH_PROOF_BYTES, BANDERSNATCH_RING_ROOT_BYTES } from "./bandersnatch-vrf.js";
import bandersnatchVrf from "./bandersnatch-vrf.js";
import { BandernsatchWasm } from "./bandersnatch-wasm/index.js";

const bandersnatchWasm = BandernsatchWasm.new({ synchronous: true });

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
      const result = await bandersnatchVrf.getRingCommitment(await bandersnatchWasm, bandersnatchKeys);
      const expectedCommitment = Bytes.parseBytes(
        "0x8387a131593447e4e1c3d4e220c322e42d33207fa77cd0fedb39fc3491479ca47a2d82295252e278fa3eec78185982ed82ae0c8fd691335e703d663fb5be02b3def15380789320636b2479beab5a03ccb3f0909ffea59d859fcdc7e187e45a8c92e630ae2b14e758ab0960e372172203f4c9a41777dadd529971d7ab9d23ab29fe0e9c85ec450505dde7f5ac038274cf",
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
            "0xb342bf8f6fa69c745daad2e99c92929b1da2b840f67e5e8015ac22dd1076343e836fc9d73929ef048dcc6496781c6780d127dd8ce3f1e0289c5c4e95afffc8d4a1586aba841ebfdb721ca86e55847036bc84f19a256dbd7a61a362fb088a4b942b566c14a7f8643a5d976ced0a18d12e32c660d59c66c271332138269cb0fe9c591182e7913ec0bbcf2290d9d68ac9d119ae78a52c0655f4f999e9e83a1c3218f65a0318ade1a5cf1d83d4448a06f856b9956a6910da242a5aaa5bcfc8ba3c05b0341a1868fc476a0d6da019b5f2b4e521903b00e937f23b17ea49d6928c615841da5442e5b070079af6cdbbaed964a9b044dcf1ae69ce2e2febec37f6369910a0b20b9dce71b4cd3396e44a90a0a4c404cb170d7ffd2c5467f152bd5daf40b38e3eecc96d13d4c8924740c14e5622b967dc587f10815bde3afe133987852e4e8a41f3501774e7d32f1014c9f0b6162bb332b36043172504aacc83bf6b13fd6018422dc207d58ca1fad63960626ea4eec25932e0b5b23b33c805603523b1f6d11ebc368b87cae1086ac609f862ac0fdab69123cbe8cfe54d45db437a87aad21ec551c394a220be6ef2fb8363352ceaf5a1a71e0b3088a6d65262c13272ac3f6313bb8cec5018414d3fd90dd15df0d56a1f0d0081e7a2abadbdde7efed75c333d4dfa93e8c3c34788a4f526e907483ac69cd7e87f11d373deaf88cf96c7e98068998e1803493a905974b1dbfb6ef38fd5785c6ca5497d21a9046790b04869fa6166067f9860e6de6f566f99ee0f3b4f4d8516c016da65dc429472ec273f7c63553cc1af565824bd9b60841be0a41988bc2ba0757166b68ee928af74d377e9ce6b98d6d6e63f6c2f8c898882fac87025bcee0451c2fea036cff1e9e7186eea4160262e6cabfac77230cd4fc7dc1ba5b025b74081c135b7b47470bc8380b2e13e6b0575b73d86de1f948e4daf8600206e0485d5b468f335f440c574213f98f4099797bd606e11e4f2d48aa5bbda17decd01077655acf756c526fe12a0153b5bd26896ae41b16479d00883649f6044631161d5b454aa4c1bc7be0acb0c82ffb98734f8c7760b930414758e1597b36e1caf71",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
        },
        {
          attempt: attempt(2),
          signature: Bytes.parseBytes(
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d11dc971f7f7ff10289130f68ce42cc70e3657d35edab1e552bc68da53008d1f58e24d90fdf1a5d78204c2c32333147976c124725b87ec1861e1ebd6252f79dc6c891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6bca7537d37b5898ef0a90a916658fb17e2cca588b7b6e96816d8683fe5028c09fc0b8cbedc791c83eab0a39434f1007d4dab587dbfc172e7d4852e5cac6810188c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f86e27d7eefac788236c548592c6d2c64c12793657caa701d418926fd952e7ba6c211a8f593b38e81f775b16be47e2f76904b5504dfbe5d64c1bcee3180f6d1cf1fc2c597f08afb1bc5213492bd9c84060ce3cb8d531e463078bac747cd66ec326e8e0171ce5d048c3839379ab96ef988130d639a15b9a76946400de42062563441394ec1f6d7f7ce90b7231325015c3f550096537c2ae86f3c774ca4265bd745b2e7365bd9478af0c389467cc34615c89cf8ff337a88d3cd2b2e1f411f714369668f0b4fa2dbb0de3c526e3a9649e82d772dc8de2259be43e3ef7508b5caeb5d57b91eaf140f89f73a57101455a87edeb10374c30a7f2b73df7b2c70c8079f415425bf10597154980bb2cc5fc209167f3b76a305d3bdc3cf6674d95c64e64734fe5af78b235945008072bcd4ae5b605bdd10ba145db56850dab84140dbb0875baba0bf1966ce71ef19770031724a2bce508498a4ff485b3089ac415c8d78dcc6ec9c02a51227875fba7bc16475de074759fa210a2723d21e5aaa0abf5eec706fc8e323c82d7aab7ed3dec320ca15aa1783707f520169ac77adaef95e7ce853b376c1b9e6425d01992fc8fc65d5e49ad47d3ba105094d37c291a287e42d37ce15873ebcb3fbc342ede527e47aea9736914f6e4b8acfa408487d5959352ac9ed48fbf01386c5db0300a7fa5b16aa4942d1",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
        },
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0x8e6eb88b02110c941451eef7da84e65bafaefcec1b1a5640ad579425e4a7e3ee629acf997108156a85e1f0b997be2ee140978aba66ff4f2037d125cfe2b8bb31984080018d9bab2ecf702a629d32dd442d3ef6f0568389ca36ebc699d24011b9a8b4b304c09306a65e8720633d53bfa3f663bb2c0c53fbb12131828de1c53ce37ad624df3fb2a48c5a533ed2f907a6fda011dcd0f93981facebf6b0f48a5da148b5061761363060cffb83713721596b82821808d873818cb43d9caec7667ce18948c0ac0e7c8105139b896fd31b08747cbd53175bce1bf2e6802ee47c2e71a3615e16a6d12c0066c7b9d99db4daaa3fa8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7fb84d49b1a744fd616eb13c737a9a192112618b47c75b4c5262b7e928daa8a0e53d5555364d6c89c57753b7d30c66f0af8109ca1a8ccdab84786b78f5e2e8bed078cd7f7e06a47c5e30034b55e76c876106071eac3283a693fb014640066f66ac766c75da8daee2253be28f3041883f2916f91694f35b8b030ff94e9492ddeb444777451524cb37e30028b1397e02812b9212fa3d27aedff0e463add1f247b64641984ec591cebffa09c349db15ddc301417de26dc9929d53b38f2e52f720fa1144f99f07b64e1df45313bdb4dcf5335ab22ffabe239c818460b8393bbb8e8273b346b95633a20b0b953f7c2081776617126a340c16cc769008897d87f69a250688a980f00fcd8360b4d85557425cabdbe3e4e15ab05ebf250750b7a05959cb16f78613cc1b3388b0f1cb5f0837f8cafb7ec2a7bb1c17043caf5504e9406dbd0eae87b61acc0c948d0f64ac0262933ed5bdd5bb44423a82f7dcf0e0b9ed08948ed7eebd71f19879321bb7c36fa0520b464d061f623b83eec704ae9d7df50658af0b64c9116471641555ed7986a29f08348e51554f5394e83e98d7301a6cb29e291d2b93c3e2ef8fe89f9d33c88da7d731e7b62ffdfa392516b51c1086e9c1a3a794b5228dfdf4a26eab4c6e4104b43997c469de2e814af0ba14954ebafb8a05bf799a33b9fe4a6a1abde66e3263ab6557",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
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

      const result = await bandersnatchVrf.verifyTickets(await bandersnatchWasm, bandersnatchKeys, tickets, entropy);

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
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d11dc971f7f7ff10289130f68ce42cc70e3657d35edab1e552bc68da53008d1f58e24d90fdf1a5d78204c2c32333147976c124725b87ec1861e1ebd6252f79dc6c891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6bca7537d37b5898ef0a90a916658fb17e2cca588b7b6e96816d8683fe5028c09fc0b8cbedc791c83eab0a39434f1007d4dab587dbfc172e7d4852e5cac6810188c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f86e27d7eefac788236c548592c6d2c64c12793657caa701d418926fd952e7ba6c211a8f593b38e81f775b16be47e2f76904b5504dfbe5d64c1bcee3180f6d1cf1fc2c597f08afb1bc5213492bd9c84060ce3cb8d531e463078bac747cd66ec326e8e0171ce5d048c3839379ab96ef988130d639a15b9a76946400de42062563441394ec1f6d7f7ce90b7231325015c3f550096537c2ae86f3c774ca4265bd745b2e7365bd9478af0c389467cc34615c89cf8ff337a88d3cd2b2e1f411f714369668f0b4fa2dbb0de3c526e3a9649e82d772dc8de2259be43e3ef7508b5caeb5d57b91eaf140f89f73a57101455a87edeb10374c30a7f2b73df7b2c70c8079f415425bf10597154980bb2cc5fc209167f3b76a305d3bdc3cf6674d95c64e64734fe5af78b235945008072bcd4ae5b605bdd10ba145db56850dab84140dbb0875baba0bf1966ce71ef19770031724a2bce508498a4ff485b3089ac415c8d78dcc6ec9c02a51227875fba7bc16475de074759fa210a2723d21e5aaa0abf5eec706fc8e323c82d7aab7ed3dec320ca15aa1783707f520169ac77adaef95e7ce853b376c1b9e6425d01992fc8fc65d5e49ad47d3ba105094d37c291a287e42d37ce15873ebcb3fbc342ede527e47aea9736914f6e4b8acfa408487d5959352ac9ed48fbf01386c5db0300a7fa5b16aa4942d1",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
        },
        {
          attempt: attempt(2),
          signature: Bytes.parseBytes(
            "0x9ddee7bb67268130bbb23889b327e662cbe832884e203148ba9b1e15539702d11dc971f7f7ff10289130f68ce42cc70e3657d35edab1e552bc68da53008d1f58e24d90fdf1a5d78204c2c32333147976c124725b87ec1861e1ebd6252f79dc6c891567467d39221b6110f5cb2ba389dba903af3fde624596f845202fcc4c96e6bca7537d37b5898ef0a90a916658fb17e2cca588b7b6e96816d8683fe5028c09fc0b8cbedc791c83eab0a39434f1007d4dab587dbfc172e7d4852e5cac6810188c521baa47ff355a99a28380d06f16b4aa3b51aac66b8a6d7bc4454b8d0f676d837caf35f2ab3c4b9ec8cd0e8fadd16e8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7f86e27d7eefac788236c548592c6d2c64c12793657caa701d418926fd952e7ba6c211a8f593b38e81f775b16be47e2f76904b5504dfbe5d64c1bcee3180f6d1cf1fc2c597f08afb1bc5213492bd9c84060ce3cb8d531e463078bac747cd66ec326e8e0171ce5d048c3839379ab96ef988130d639a15b9a76946400de42062563441394ec1f6d7f7ce90b7231325015c3f550096537c2ae86f3c774ca4265bd745b2e7365bd9478af0c389467cc34615c89cf8ff337a88d3cd2b2e1f411f714369668f0b4fa2dbb0de3c526e3a9649e82d772dc8de2259be43e3ef7508b5caeb5d57b91eaf140f89f73a57101455a87edeb10374c30a7f2b73df7b2c70c8079f415425bf10597154980bb2cc5fc209167f3b76a305d3bdc3cf6674d95c64e64734fe5af78b235945008072bcd4ae5b605bdd10ba145db56850dab84140dbb0875baba0bf1966ce71ef19770031724a2bce508498a4ff485b3089ac415c8d78dcc6ec9c02a51227875fba7bc16475de074759fa210a2723d21e5aaa0abf5eec706fc8e323c82d7aab7ed3dec320ca15aa1783707f520169ac77adaef95e7ce853b376c1b9e6425d01992fc8fc65d5e49ad47d3ba105094d37c291a287e42d37ce15873ebcb3fbc342ede527e47aea9736914f6e4b8acfa408487d5959352ac9ed48fbf01386c5db0300a7fa5b16aa4942d1",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
        },
        {
          attempt: attempt(1),
          signature: Bytes.parseBytes(
            "0x8e6eb88b02110c941451eef7da84e65bafaefcec1b1a5640ad579425e4a7e3ee629acf997108156a85e1f0b997be2ee140978aba66ff4f2037d125cfe2b8bb31984080018d9bab2ecf702a629d32dd442d3ef6f0568389ca36ebc699d24011b9a8b4b304c09306a65e8720633d53bfa3f663bb2c0c53fbb12131828de1c53ce37ad624df3fb2a48c5a533ed2f907a6fda011dcd0f93981facebf6b0f48a5da148b5061761363060cffb83713721596b82821808d873818cb43d9caec7667ce18948c0ac0e7c8105139b896fd31b08747cbd53175bce1bf2e6802ee47c2e71a3615e16a6d12c0066c7b9d99db4daaa3fa8d6db123d2815dbfa6cbe74866ed9855eecbbab8e2011f84f71a2e360caeac3bcd64c4b46b11ca167e238cf5f0ccfe7fb84d49b1a744fd616eb13c737a9a192112618b47c75b4c5262b7e928daa8a0e53d5555364d6c89c57753b7d30c66f0af8109ca1a8ccdab84786b78f5e2e8bed078cd7f7e06a47c5e30034b55e76c876106071eac3283a693fb014640066f66ac766c75da8daee2253be28f3041883f2916f91694f35b8b030ff94e9492ddeb444777451524cb37e30028b1397e02812b9212fa3d27aedff0e463add1f247b64641984ec591cebffa09c349db15ddc301417de26dc9929d53b38f2e52f720fa1144f99f07b64e1df45313bdb4dcf5335ab22ffabe239c818460b8393bbb8e8273b346b95633a20b0b953f7c2081776617126a340c16cc769008897d87f69a250688a980f00fcd8360b4d85557425cabdbe3e4e15ab05ebf250750b7a05959cb16f78613cc1b3388b0f1cb5f0837f8cafb7ec2a7bb1c17043caf5504e9406dbd0eae87b61acc0c948d0f64ac0262933ed5bdd5bb44423a82f7dcf0e0b9ed08948ed7eebd71f19879321bb7c36fa0520b464d061f623b83eec704ae9d7df50658af0b64c9116471641555ed7986a29f08348e51554f5394e83e98d7301a6cb29e291d2b93c3e2ef8fe89f9d33c88da7d731e7b62ffdfa392516b51c1086e9c1a3a794b5228dfdf4a26eab4c6e4104b43997c469de2e814af0ba14954ebafb8a05bf799a33b9fe4a6a1abde66e3263ab6557",
            BANDERSNATCH_PROOF_BYTES,
          ).asOpaque(),
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

      const result = await bandersnatchVrf.verifyTickets(await bandersnatchWasm, bandersnatchKeys, tickets, entropy);

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

      const result = await (await bandersnatchWasm).verifySeal(
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

      const result = await (await bandersnatchWasm).verifySeal(
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
