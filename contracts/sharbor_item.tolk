tolk 1.1

/**
 * Sharbor NFT Item (TEP-62 style, refined for sharding)
 * Storage tracks:
 * - collection: address
 * - owner: address
 * - index: uint64
 * - parent_nft_address: address   // lineage link to parent
 * - lineage_length: uint32        // generation distance from initial root
 * - is_eligible_for_sharding: bool // toggled via admin CheckStatus message
 * - admin: address                // admin who can toggle eligibility
 * - content: cell                 // metadata cell
 *
 * Cross-contract sharding flow:
 * - Owner sends ShardingRequest(proof, leaf, new_sharbor_data).
 * - Item checks is_eligible_for_sharding and ownership.
 * - Item constructs MintSharbor payload and (hackathon) hands it off to Collection.
 * - Collection verifies Merkle proof against cached root and mints new item with updated lineage.
 */

struct ExtraFields {
    parent_nft_address: address
    lineage_length: uint32
    is_eligible_for_sharding: bool
    admin: address
    content: cell
}

struct Storage {
    collection: address
    owner: address
    index: uint64
    extra: cell
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

// Helpers to load/save nested extra fields (stored as a ref cell)
fun Storage.loadExtra(self): ExtraFields {
    return ExtraFields.fromCell(self.extra);
}

fun Storage.saveExtra(mutate self, e: ExtraFields) {
    self.extra = e.toCell();
}

// Helper: compare two addresses/slices via hashed cell representation
fun addressesEqual(a: address, b: address): bool {
    var ba = beginCell();
    ba.storeAddress(a);
    val ca = ba.toCell();

    var bb = beginCell();
    bb.storeAddress(b);
    val cb = bb.toCell();

    return ca.hash() == cb.hash();
}

// Transfer ownership (owner-only)
// For hackathon simplicity, include the sender address in the message and compare with stored owner.
// In production you would validate via msg sender info.
struct (0x5fcc3d14) Transfer {
    queryId: uint64
    new_owner: address
    sender_address: address
}

// Admin-only: set sharding eligibility status
struct (0xA11C0F01) CheckStatus {
    queryId: uint64
    eligible: bool
    sender_address: address
}

// Owner-only sharding request: verify availability proof and ask Collection to mint
struct (0x62F1A100) ShardingRequest {
    queryId: uint64
    proof: cell
    leaf: cell
    new_sharbor_data: cell
    sender_address: address
}

type AllowedMessage = Transfer | CheckStatus | ShardingRequest

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        Transfer => {
            var storage = lazy Storage.load();

            // Only the current owner can transfer
            assert (addressesEqual(storage.owner, msg.sender_address)) throw 0xBAD0;

            storage.owner = msg.new_owner;
            storage.save();
        }

        CheckStatus => {
            var storage = lazy Storage.load();

var ext = storage.loadExtra();

// Admin-only toggle of sharding eligibility
assert (addressesEqual(ext.admin, msg.sender_address)) throw 0xAD10;

ext.is_eligible_for_sharding = msg.eligible;
storage.saveExtra(ext);
storage.save();
        }

        ShardingRequest => {
            var storage = lazy Storage.load();
var ext = storage.loadExtra();

// Owner-only and must be eligible for sharding
assert (addressesEqual(storage.owner, msg.sender_address)) throw 0xBAD1;
assert (ext.is_eligible_for_sharding) throw 0xBAD2;

// Compute next generation lineage length
val new_lineage: uint32 = ext.lineage_length + 1;

            // Derive a pseudo self address for parent reference (hackathon convention)
            var selfAddrDeriveB = beginCell();
            selfAddrDeriveB.storeRef(contract.getData());
            val pseudoItemAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

            // Cross-contract message flow:
            // - Item sends an internal message to the Sharbor Collection with MintSharbor opcode.
            // - Collection validates Merkle proof locally against its cached root snapshot
            //   (since on-chain GET from MerkleRoot.verify_proof is unavailable).
            // - If verification passes, Collection mints a new item with:
            //   parent_nft_address = this item's address (pseudoItemAddr)
            //   lineage_length     = storage.lineage_length + 1
            //
            // NOTE: Sending is mocked in this hackathon. We construct the body payload here
            // so off-chain controllers can relay it to the collection.
            var b = beginCell();
            b.storeUint(0x62F1A001, 32);           // MintSharbor opcode
            b.storeUint(msg.queryId, 64);
            b.storeAddress(storage.owner);          // new NFT owner stays the current owner
            b.storeAddress(pseudoItemAddr);         // parent_nft_address
            b.storeRef(msg.new_sharbor_data);       // metadata cell (see SharborMetadata struct)
            b.storeRef(msg.leaf);
            b.storeRef(msg.proof);
            b.storeUint(new_lineage, 32);           // lineage_length

            val mintBody = b.toCell();

            // In production: contract.sendInternal(storage.collection, mintBody, value=0, bounce=true)
            // Hackathon: off-chain relayer should pick mintBody and post to collection.
            // Optionally: persist mintBody for off-chain reading or emit via a no-op internal send.
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {
}

// External entrypoint: owner-only sharding_request(proof, leaf, new_sharbor_data)
// Emits the same MintSharbor payload used by ShardingRequest in onInternalMessage.
// Note: For hackathon we construct the payload for off-chain relayer; no actual send.
fun onExternalMessage(in: InMessage) {
    // Expect body layout: [opcode, queryId, proof, leaf, new_sharbor_data, sender_address]
    // To keep it simple, we reuse ShardingRequest struct for parsing.
    val msg = lazy ShardingRequest.fromSlice(in.body);

    var storage = lazy Storage.load();

    // Owner-only callable
    assert (addressesEqual(storage.owner, msg.sender_address)) throw 0xBAD3;

var ext = storage.loadExtra();

// Must be eligible
assert (ext.is_eligible_for_sharding) throw 0xBAD4;

// Compute next generation lineage
val new_lineage: uint32 = ext.lineage_length + 1;

    // Derive pseudo self address for parent reference (hackathon convention)
    var selfAddrDeriveB = beginCell();
    selfAddrDeriveB.storeRef(contract.getData());
    val pseudoItemAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

    // Build MintSharbor body identical to internal path
    var b = beginCell();
    b.storeUint(0x62F1A001, 32);           // MintSharbor opcode
    b.storeUint(msg.queryId, 64);
    b.storeAddress(storage.owner);          // new NFT owner stays the current owner
    b.storeAddress(pseudoItemAddr);         // parent_nft_address
    b.storeRef(msg.new_sharbor_data);       // metadata cell
    b.storeRef(msg.leaf);
    b.storeRef(msg.proof);
    b.storeUint(new_lineage, 32);           // lineage_length

    val mintBody = b.toCell();

    // In production: contract.sendInternal(storage.collection, mintBody, value=0, bounce=true)
    // Hackathon: off-chain relayer should pick mintBody and post to collection.
}

// Getters consistent with TEP-62 expectations (minimal)
get fun get_nft_data(): (int, address, address, cell) {
    // returns: index, collection, owner, content
    val s = lazy Storage.load();
    val e = s.loadExtra();
    return (s.index, s.collection, s.owner, e.content);
}

get fun get_owner(): address {
    val s = lazy Storage.load();
    return s.owner;
}

get fun get_index(): int {
    val s = lazy Storage.load();
    return s.index;
}

get fun get_collection(): address {
    val s = lazy Storage.load();
    return s.collection;
}

get fun get_parent(): address {
    val s = lazy Storage.load();
    val e = s.loadExtra();
    return e.parent_nft_address;
}

// Lineage depth from initial generation
get fun get_lineage_length(): int {
    val s = lazy Storage.load();
    val e = s.loadExtra();
    return e.lineage_length;
}

// Eligibility flag controlled by admin via CheckStatus
get fun get_sharding_eligibility(): bool {
    val s = lazy Storage.load();
    val e = s.loadExtra();
    return e.is_eligible_for_sharding;
}

get fun get_content(): cell {
    val s = lazy Storage.load();
    val e = s.loadExtra();
    return e.content;
}

// Optional metadata struct helpers (fertility & aesthetics used by mutation logic)
struct SharborMetadata {
    fertility_score: uint8
    aesthetics_type: uint8
}
