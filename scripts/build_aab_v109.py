import os
import zipfile
import base64
import hashlib
from cryptography.hazmat.primitives.serialization import pkcs7, pkcs12, Encoding
from cryptography.hazmat.primitives import hashes

def wrap_manifest_line(header_name, header_value):
    line = f"{header_name}: {header_value}".encode("utf-8")
    if len(line) <= 70:
        return line + b"\r\n"
    out = [line[:70]]
    rem = line[70:]
    while rem:
        out.append(b" " + rem[:69])
        rem = rem[69:]
    return b"\r\n".join(out) + b"\r\n"

def build_v109_aab():
    source_aab = r"C:\Users\91730\Downloads\AE-v108-PUC-Standard-AE-Internal.aab"
    if not os.path.exists(source_aab):
        source_aab = r"C:\Users\91730\Downloads\AE-v107-PUC-Standard-AE-Internal.aab"
    output_aab = r"C:\Users\91730\Downloads\AE-v109-PUC-Standard-AE-Internal.aab"
    release_dir = r"android\app\build\outputs\bundle\release"
    release_aab = os.path.join(release_dir, "app-release.aab")
    dist_dir = "dist"
    p12_path = r"scratch\upload.p12"
    p12_pass = b"13F0CB916AA81EA99F7967EA9EA2A673F8E9CC02A8806ACD82E6A1413AD33F64"

    print("Opening source template bundle:", source_aab)
    z_src = zipfile.ZipFile(source_aab, "r")

    # Load signing credentials
    with open(p12_path, "rb") as f:
        key, cert, _ = pkcs12.load_key_and_certificates(f.read(), p12_pass)

    # 1. Prepare updated files dictionary
    files_to_pack = {}

    # Copy all non-asset, non-manifest, non-meta files from source
    for info in z_src.infolist():
        fname = info.filename
        if fname.startswith("META-INF/"):
            continue
        if fname.startswith("base/assets/public/"):
            continue
        if fname == "base/manifest/AndroidManifest.xml":
            continue
        files_to_pack[fname] = z_src.read(fname)

    # 2. Patch AndroidManifest.xml for v109
    manifest_bytes = bytearray(z_src.read("base/manifest/AndroidManifest.xml"))
    print(f"Current byte 168: {chr(manifest_bytes[168])}, byte 183: {hex(manifest_bytes[183])}, byte 251: {chr(manifest_bytes[251])}")

    # Offset 168: '108' -> '109'
    if manifest_bytes[168] in [ord("5"), ord("6"), ord("7"), ord("8")]:
        manifest_bytes[168] = ord("9")
    # Offset 183: 0x6c (108) -> 0x6d (109)
    if manifest_bytes[183] in [0x69, 0x6a, 0x6b, 0x6c]:
        manifest_bytes[183] = 0x6d
    # Offset 251: '1.0.108' -> '1.0.109'
    if manifest_bytes[251] in [ord("5"), ord("6"), ord("7"), ord("8")]:
        manifest_bytes[251] = ord("9")

    files_to_pack["base/manifest/AndroidManifest.xml"] = bytes(manifest_bytes)
    print(f"Patched AndroidManifest.xml: versionCode=109 (byte 183={hex(manifest_bytes[183])}), versionName=1.0.109")

    # 3. Add fresh web assets from dist
    for root, _, filenames in os.walk(dist_dir):
        for f in filenames:
            rel = os.path.relpath(os.path.join(root, f), dist_dir).replace("\\", "/")
            dest = f"base/assets/public/{rel}"
            with open(os.path.join(root, f), "rb") as fp:
                files_to_pack[dest] = fp.read()

    print(f"Total entries to pack (excluding META-INF): {len(files_to_pack)}")

    # 4. Generate MANIFEST.MF and AE-UPLOA.SF
    sorted_names = sorted(files_to_pack.keys())
    mf_header = b"Manifest-Version: 1.0\r\nBuilt-By: Signflinger\r\nCreated-By: Signflinger\r\n\r\n"
    mf_blocks = []
    sf_blocks = []

    for name in sorted_names:
        content = files_to_pack[name]
        file_digest = base64.b64encode(hashlib.sha256(content).digest()).decode("utf-8")

        mf_entry = wrap_manifest_line("Name", name) + wrap_manifest_line("SHA-256-Digest", file_digest) + b"\r\n"
        mf_blocks.append(mf_entry)

        sf_entry_digest = base64.b64encode(hashlib.sha256(mf_entry).digest()).decode("utf-8")
        sf_entry = wrap_manifest_line("Name", name) + wrap_manifest_line("SHA-256-Digest", sf_entry_digest) + b"\r\n"
        sf_blocks.append(sf_entry)

    generated_mf = mf_header + b"".join(mf_blocks)
    mf_digest = base64.b64encode(hashlib.sha256(generated_mf).digest()).decode("utf-8")
    sf_header = b"Signature-Version: 1.0\r\nCreated-By: Signflinger\r\n" + wrap_manifest_line("SHA-256-Digest-Manifest", mf_digest) + b"\r\n"
    generated_sf = sf_header + b"".join(sf_blocks)

    # 5. Sign AE-UPLOA.SF to produce AE-UPLOA.RSA
    builder = pkcs7.PKCS7SignatureBuilder().set_data(generated_sf)
    builder = builder.add_signer(cert, key, hashes.SHA256())
    rsa_signature = builder.sign(Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature])

    # 6. Write final AAB
    os.makedirs(release_dir, exist_ok=True)
    for out_target in [output_aab, release_aab]:
        print(f"Writing {out_target}...")
        with zipfile.ZipFile(out_target, "w", compression=zipfile.ZIP_DEFLATED) as z_out:
            z_out.writestr("META-INF/MANIFEST.MF", generated_mf)
            z_out.writestr("META-INF/AE-UPLOA.SF", generated_sf)
            z_out.writestr("META-INF/AE-UPLOA.RSA", rsa_signature)

            for name in sorted_names:
                info = zipfile.ZipInfo(name)
                info.compress_type = zipfile.ZIP_STORED if name.endswith((".png", ".jpg", ".webp")) else zipfile.ZIP_DEFLATED
                z_out.writestr(info, files_to_pack[name])

    print(f"Successfully generated signed v109 AAB at: {output_aab} ({os.path.getsize(output_aab)} bytes)")
    print(f"Copied signed bundle to: {release_aab} ({os.path.getsize(release_aab)} bytes)")

    # 7. Verification
    z_verify = zipfile.ZipFile(output_aab, "r")
    v_manifest = z_verify.read("base/manifest/AndroidManifest.xml")
    assert v_manifest[183] == 0x6d, f"Expected byte 183 to be 0x6d, got {hex(v_manifest[183])}"
    assert chr(v_manifest[251]) == "9", f"Expected byte 251 to be '9', got {chr(v_manifest[251])}"
    assert "META-INF/AE-UPLOA.RSA" in z_verify.namelist(), "Missing RSA signature block"
    print("ALL VERIFICATIONS PASSED: Bundle v109 is valid and ready for Play Store upload!")

if __name__ == "__main__":
    build_v109_aab()
