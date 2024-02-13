import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import { Program } from "@coral-xyz/anchor";
import { Growth } from "../target/types/growth";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toBigNumber,
} from "@metaplex-foundation/js";

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

describe("Growth", () => {
  // Configure the client to use the local cluster.
  const env = anchor.AnchorProvider.env();
  anchor.setProvider(env);
  const metaplex = Metaplex.make(env.connection);

  const program = anchor.workspace.Growth as Program<Growth>;

  const getMetadata = (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];
  };

  const getMasterEdition = (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];
  };

  const getCollectionAuthorityPDA = (mint: PublicKey, authority: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("collection_authority"),
        authority.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )[0];
  };

  console.log(program.programId.toBase58());
  const getOrg = (mint: PublicKey, authority: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("org"), mint.toBuffer(), authority.toBuffer()],
      program.programId
    )[0];
  };

  const getScore = (orgAddress: PublicKey, applicant: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("score"), orgAddress.toBuffer(), applicant.toBuffer()],
      program.programId
    )[0];
  };

  const decodedAuthorityKey = new Uint8Array(
    JSON.parse(
      fs.readFileSync(path.join(__dirname, "../authority.json")).toString()
    )
  );
  let authority = Keypair.fromSecretKey(decodedAuthorityKey);

  const decodedApplicantKey = new Uint8Array(
    JSON.parse(
      fs.readFileSync(path.join(__dirname, "../applicant.json")).toString()
    )
  );
  let applicant = Keypair.fromSecretKey(decodedApplicantKey);

  const orgMint = Keypair.generate();
  const orgAddress = getOrg(orgMint.publicKey, authority.publicKey);
  const orgMaster = getMasterEdition(orgMint.publicKey);
  const orgMetadataAddress = getMetadata(orgMint.publicKey);

  const registerMint = Keypair.generate();
  const registerMetadataAddress = getMetadata(registerMint.publicKey);

  const scoreAddress = getScore(orgAddress, applicant.publicKey);

  it("Is Creating Org!", async () => {
    let orgMintATA = getAssociatedTokenAddressSync(
      orgMint.publicKey,
      orgAddress,
      true
    );
    console.log("Org ATA", orgMintATA.toBase58());

    const weights = [4, 1, 1, 1, 1, 2, 1, 1, 1, 1];
    const ranges = [2];
    const levels = [
      [25, 50, 75],
      [25, 75],
    ];
    const tx = await program.methods
      .createOrganization(
        Buffer.from(weights),
        Buffer.from(ranges),
        levels,
        Buffer.from("Designity"),
        2,
        "https://public.designity.software",
        5
      )
      .accounts({
        org: orgAddress,
        orgMint: orgMint.publicKey,
        authority: authority.publicKey,
        metadata: orgMetadataAddress,
        masterEdition: orgMaster,
        tokenAccount: orgMintATA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority, orgMint])
      .rpc({
        commitment: "confirmed",
        skipPreflight: true,
      });
    console.log("Create Org signature", tx);
    // let mplxOrgMint = await metaplex.nfts().findByMint({
    //   mintAddress: orgMint.publicKey,
    // });
    // console.log("MPLX Org", JSON.stringify(mplxOrgMint));
    const orgAccount = await program.account.org.fetch(orgAddress);
    console.log("org account data: ", orgAccount);
  });
  it("Is Registering!", async () => {
    const applicanMint = await createMint(
      env.connection,
      applicant,
      orgAddress,
      orgAddress,
      0,
      registerMint,
      {
        commitment: "confirmed",
      }
    );
    console.log(`Applicant mint is created, ${applicanMint.toBase58()}`);

    let registerMintATA = await getOrCreateAssociatedTokenAccount(
      env.connection,
      authority,
      registerMint.publicKey,
      applicant.publicKey
    );

    const tx1 = await program.methods
      .register("Saber", Buffer.from([1, 1]), toBigNumber(Date.now()/1000))
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        collectionMaster: orgMaster,
        score: scoreAddress,
        registerMint: registerMint.publicKey,
        metadata: registerMetadataAddress,
        tokenAccount: registerMintATA.address,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc({
        skipPreflight: true,
        commitment: "confirmed",
      });
    console.log("Register signature", tx1);
    let scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: submited_score on ${scoreAccount.lastUpdate.toString()}`, scoreAccount);
  });
  it("Is Verifying!", async () => {
    const txVerify = await program.methods
      .verify()
      .accounts({
        authority: authority.publicKey,
        metadata: registerMetadataAddress,
        org: orgAddress,
        orgMint: orgMint.publicKey,
        collectionMaster: orgMaster,
        collectionMetadata: orgMetadataAddress,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc({
        skipPreflight: true,
        commitment: "confirmed",
      });
    console.log("Verify signature", txVerify);
  });
  it("Is Receiving scores!", async () => {
    await wait(2);
    let score = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    let tx3 = await program.methods
      .receiveScore(Buffer.from(score))
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc({
        skipPreflight: true,
      });
    console.log("Scoring signature", tx3);
    let scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: submited_score[${score}] `, scoreAccount);

    await wait(6);
    score = [40, 50, 50, 55, 55, 59, 50, 50, 55, 50];
    tx3 = await program.methods
      .receiveScore(Buffer.from(score))
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
    console.log("Scoring signature", tx3);
    scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: submited_score[${score}] `, scoreAccount);

    await wait(2);
    score = [100, 100, 50, 60, 45, 90, 50, 80, 90, 90];
    tx3 = await program.methods
      .receiveScore(Buffer.from(score))
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
    console.log("Scoring signature", tx3);
    scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: submited_score[${score}] `, scoreAccount);

    await wait(10);
    score = [100, 100, null, null, null, null, null, null, null, null];
    tx3 = await program.methods
      .receiveScore(Buffer.from(score))
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
    console.log("Scoring signature", tx3);
    scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: submited_score[${score}] `, scoreAccount);

    let mplxMint = await metaplex.nfts().findByMint({
      mintAddress: registerMint.publicKey,
    });
    console.log("MPLX", JSON.stringify(mplxMint));
  });
  it("Is bulk load scores", async () => {
    let tx3 = await program.methods
      .updateScores(
        Buffer.from([100, 80, 100, 100, 180, 170, 160, 150, 130, 150]),
        Buffer.from([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
        toBigNumber("1692393205"),
        Buffer.from([2, 2]),
        true
      )
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc({
        skipPreflight: true,
      });
    console.log("Scoring signature", tx3);
    let scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: `, scoreAccount);
  });
  it("Is sending scores", async () => {
    let tx3 = await program.methods
      .sendScore()
      .accounts({
        authority: authority.publicKey,
        applicant: applicant.publicKey,
        org: orgAddress,
        metadata: registerMetadataAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([authority])
      .rpc({
        skipPreflight: true,
      });
    console.log("Scoring signature", tx3);
    let scoreAccount = await program.account.score.fetch(scoreAddress);
    console.log(`score account data: `, scoreAccount);
  });
});
