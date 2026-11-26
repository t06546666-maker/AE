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

def build_v104_aab():
    source_aab = r"C:\Users\91730\Downloads\AE-v103-PUC-Standard-AE-Internal.aab"
    output_aab = r"C:\Users\91730\Downloads\AE-v104-PUC-Standard-AE-Internal.aab"
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

    # 2. Patch AndroidManifest.xml for v104
    manifest_bytes = bytearray(z_src.read("base/manifest/AndroidManifest.xml"))
    # Offset 168: '103' -> '104'
    if manifest_bytes[168] in [ord("2"), ord("3")]:
        manifest_bytes[168] = ord("4")
    # Offset 183: 0x67 (103) -> 0x68 (104)
    if manifest_bytes[183] in [0x66, 0x67]:
        manifest_bytes[183] = 0x68
    # Offset 251: '1.0.103' -> '1.0.104'
    if manifest_bytes[251] in [ord("2"), ord("3")]:
        manifest_bytes[251] = ord("4")

    files_to_pack["base/manifest/AndroidManifest.xml"] = bytes(manifest_bytes)
    print(f"Patched AndroidManifest.xml: versionCode=104 (byte 183={hex(manifest_bytes[183])}), versionName=1.0.104")

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
    generated_rsa = builder.sign(Encoding.DER, options=[pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.NoAttributes])

    print(f"Generated MF length: {len(generated_mf)}")
    print(f"Generated SF length: {len(generated_sf)}")
    print(f"Generated RSA length: {len(generated_rsa)}")

    # 6. Write output AAB
    os.makedirs(release_dir, exist_ok=True)
    fixed_time = (1981, 1, 1, 1, 1, 2)

    for target_path in [output_aab, release_aab]:
        print(f"Writing {target_path}...")
        with zipfile.ZipFile(target_path, "w", compression=zipfile.ZIP_DEFLATED) as z_out:
            for name in sorted_names:
                zinfo = zipfile.ZipInfo(filename=name, date_time=fixed_time)
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                zinfo.external_attr = 0o644 << 16
                z_out.writestr(zinfo, files_to_pack[name])

            for meta_name, meta_data in [
                ("META-INF/AE-UPLOA.SF", generated_sf),
                ("META-INF/AE-UPLOA.RSA", generated_rsa),
                ("META-INF/MANIFEST.MF", generated_mf),
            ]:
                zinfo = zipfile.ZipInfo(filename=meta_name, date_time=fixed_time)
                zinfo.compress_type = zipfile.ZIP_DEFLATED
                zinfo.external_attr = 0o644 << 16
                z_out.writestr(zinfo, meta_data)

    print("Successfully built and signed v104 bundle!")

if __name__ == "__main__":
    build_v104_aab()
