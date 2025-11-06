tolk 1.1

// Sharbor NFT Collection (TEP-62, minimal hackathon version)
// Focus: simple mint gated by Merkle proof. Cross-contract GET to MerkleRoot is mocked,
// we run the same verification locally against a cached root snapshot.
//
// Storage keeps:
// - merkle_root_contract: slice (address of Merkle Root Contract, informational)
// - current_merkle_root: cell (cached root snapshot; backend should keep this in sync)
// - next_index: uint64 (auto-increment token index)
// - item_code: cell (code cell for Sharbor Item contract; used to compute item address and deploy)
// - collection_content: cell (arbitrary metadata for collection)
// - admin: slice (optional admin; can update root snapshot, item code and content)

struct Storage {
    merkle_root_contract: address
    current_merkle_root: cell
    next_index: uint64
    item_code: cell
    collection_content: cell
    admin: address
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
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

// Reuse simple Merkle utilities (same convention as merkle_root.tolk)
fun hashPair(left: cell, right: cell): cell {
    var b = beginCell();
    b.storeRef(left);
    b.storeRef(right);
    return b.toCell();
}

// proof cell is expected to contain a sequence:
//   [dir_bit, sibling_ref] repeated until empty
// dir_bit: 0 = current on left, 1 = current on right
fun verifyProofAgainstRoot(root: cell, leaf: cell, proof: cell): bool {
    var current = leaf;
    var ps = proof.beginParse();

    while (!ps.isEmpty()) {
        val dir = ps.loadUint(1);
        val sibling = ps.loadRef();

        var parent: cell;
        if (dir == 0) {
            parent = hashPair(current, sibling);
        } else {
            parent = hashPair(sibling, current);
        }
        current = parent;
    }

    return current.hash() == root.hash();
}

// Administrative updates

struct (0xA1C30001) UpdateRootSnapshot {
    queryId: uint64
    new_root: cell
    sender_address: address
}

struct (0xA1C30002) UpdateItemCode {
    queryId: uint64
    new_item_code: cell
    sender_address: address
}

struct (0xA1C30003) UpdateCollectionContent {
    queryId: uint64
    new_collection_content: cell
    sender_address: address
}

struct (0xA1C30004) SetMerkleRootContractAddr {
    queryId: uint64
    new_merkle_root_contract: address
    sender_address: address
}

/**
 * MintSharbor: internal mint request produced by Item during sharding.
 * Extended to include lineage_length so the collection can set it when building item data.
 */
struct (0x62F1A001) MintSharbor {
    queryId: uint64
    owner: address
    parent_address: address
    metadata: cell
    leaf: cell
    proof: cell
    lineage_length: uint32
}

type AllowedMessage = UpdateRootSnapshot | UpdateItemCode | UpdateCollectionContent | SetMerkleRootContractAddr | MintSharbor

// Build initial data cell for Sharbor Item Storage
// NOTE: We store `collection` as this contract address. Tolk does not show a built-in
// API for fetching own address in the sample; for hackathon we accept passing it via builder.
// If unavailable, you may pass `collection` from deploy scripts. Here we mimic it by requiring
// deploy-time initialization to encode the correct collection slice into contract data.
fun buildItemData(collection: address, owner: address, index: uint64, parent_nft_address: address, lineage_length: uint32, content: cell, admin: address, is_eligible_for_sharding: bool): cell {
    // Sharbor Item Storage layout with nested ExtraFields:
    // struct Storage {
    //   collection: address
    //   owner: address
    //   index: uint64
    //   extra: cell
    // }
    // struct ExtraFields {
    //   parent_nft_address: address
    //   lineage_length: uint32
    //   is_eligible_for_sharding: bool
    //   admin: address
    //   content: cell
    // }
    // Build ExtraFields cell first
    var extraB = beginCell();
    extraB.storeAddress(parent_nft_address);
    extraB.storeUint(lineage_length, 32);
    extraB.storeUint(is_eligible_for_sharding ? 1 : 0, 1);
    extraB.storeAddress(admin);
    extraB.storeRef(content);
    val extraCell = extraB.toCell();

    // Build top-level Storage with a ref to ExtraFields
    var b = beginCell();
    b.storeAddress(collection);
    b.storeAddress(owner);
    b.storeUint(index, 64);
    b.storeRef(extraCell);
    return b.toCell();
}

// Compute pseudo address for item given code+data.
// In TON, address = hash(workchain_id + code + data). For hackathon purposes, we return a slice
// derived from hashing code+data, which is sufficient for demos and off-chain indexing.
fun computeItemAddress(code: cell, data: cell): address {
    var bb = beginCell();
    bb.storeRef(code);
    bb.storeRef(data);
    val comp = bb.endCell();
    val h = comp.hash();
    // Encode 256-bit hash into a slice (not a real std address, but deterministic)
    var s = beginCell();
    s.storeUint(h, 256);
    return s.endCell().beginParse().loadAddress();
}

// Mock deploy function: in production you'd send an internal message to the derived address
// with proper StateInit (code+data) and an init bounce. For hackathon we only compute the address.
fun mockDeployItem(code: cell, data: cell): address {
    return computeItemAddress(code, data);
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);

    match (msg) {
        UpdateRootSnapshot => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0xAD01;
            s.current_merkle_root = msg.new_root;
            s.save();
        }

        UpdateItemCode => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0xAD02;
            s.item_code = msg.new_item_code;
            s.save();
        }

        UpdateCollectionContent => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0xAD03;
            s.collection_content = msg.new_collection_content;
            s.save();
        }

        SetMerkleRootContractAddr => {
            var s = lazy Storage.load();
            assert (addressesEqual(s.admin, msg.sender_address)) throw 0xAD04;
            s.merkle_root_contract = msg.new_merkle_root_contract;
            s.save();
        }

        MintSharbor => {
            var s = lazy Storage.load();

            // "Call" MerkleRoot.verify_proof getter (mocked).
            // Since on-chain GET calls are not available to contracts, we run the same
            // verification locally against our cached root snapshot.
            val ok = verifyProofAgainstRoot(s.current_merkle_root, msg.leaf, msg.proof);
            assert (ok) throw 0x6201;

            val index = s.next_index;

            // Derive pseudo collection address (hackathon)
            var selfAddrDeriveB = beginCell();
            selfAddrDeriveB.storeRef(contract.getData());
            val pseudoCollectionAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

            // Set admin and initial eligibility defaults for new item:
            // - Admin is this collection's admin to allow CheckStatus later
            // - is_eligible_for_sharding defaults to false (explicitly set later by admin)
            val new_item_admin = s.admin;
            val initial_eligible = false;

            // Build item data including lineage metadata
            val itemData = buildItemData(
                pseudoCollectionAddr,
                msg.owner,
                index,
                msg.parent_address,
                msg.lineage_length,
                msg.metadata,
                new_item_admin,
                initial_eligible
            );

            // Deploy item (mocked) and increment index
            val itemAddress = mockDeployItem(s.item_code, itemData);

            s.next_index = index + 1;
            s.save();

            // Cross-contract message flow commentary:
            // - Item constructed MintSharbor with parent_nft_address and lineage_length.
            // - Collection verified the Merkle proof and minted the child item.
            // - New item storage persists lineage traits and default sharding eligibility.
        }

        else => {
            // ignore empty messages, "wrong opcode" for others
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}

fun onBouncedMessage(in: InMessageBounced) {
}

// Getters per TEP-62 minimal expectations
// Return: next_index, collection_content, item_code
get fun get_collection_data(): (int, cell, cell) {
    val s = lazy Storage.load();
    return (s.next_index, s.collection_content, s.item_code);
}

get fun get_merkle_root_snapshot(): cell {
    val s = lazy Storage.load();
    return s.current_merkle_root;
}

get fun get_merkle_root_contract(): address {
    val s = lazy Storage.load();
    return s.merkle_root_contract;
}

// Convenience: compute item address for an index with given owner/parent/metadata (deterministic if inputs match mint)
get fun get_nft_address(owner: address, parent_address: address, metadata: cell, index: int, lineage_length: int): address {
    val s = lazy Storage.load();

    var selfAddrDeriveB = beginCell();
    selfAddrDeriveB.storeRef(contract.getData());
    val pseudoCollectionAddr = selfAddrDeriveB.endCell().beginParse().loadAddress();

    // For off-chain preview, assume admin = s.admin and eligibility=false
    val itemData = buildItemData(pseudoCollectionAddr, owner, index, parent_address, lineage_length, metadata, s.admin, false);
    return computeItemAddress(s.item_code, itemData);
}
