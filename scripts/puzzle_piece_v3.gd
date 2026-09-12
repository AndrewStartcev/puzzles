class_name PuzzlePieceV3
extends Node2D

signal locked_in_place(piece)

var target_position: Vector2 = Vector2.ZERO
var snap_distance: float = 42.0
var piece_id: int = -1
var locked: bool = false

var _polygon: PackedVector2Array
var _uv: PackedVector2Array
var _closed_outline: PackedVector2Array
var _bounds: Rect2
var _texture: Texture2D
var _display_scale: float = 1.0
var _drag_offset: Vector2 = Vector2.ZERO
var _lifted: bool = false
var _detail_level: int = 0
var _base_z_index: int = 10


func setup(
	texture: Texture2D,
	polygon_points: PackedVector2Array,
	uv_points: PackedVector2Array,
	target: Vector2,
	display_scale: float,
	id: int,
	snap_distance_px: float,
	detail_level: int = 0
) -> void:
	_texture = texture
	_polygon = polygon_points
	_uv = uv_points
	target_position = target
	_display_scale = display_scale
	piece_id = id
	snap_distance = snap_distance_px
	_detail_level = detail_level
	z_index = _base_z_index
	scale = Vector2.ONE * display_scale

	_closed_outline = _polygon.duplicate()
	if not _polygon.is_empty():
		_closed_outline.append(_polygon[0])
	_bounds = _calculate_bounds(_polygon)
	queue_redraw()


func place_scrambled(at_position: Vector2) -> void:
	locked = false
	_lifted = false
	position = at_position
	z_index = _base_z_index
	queue_redraw()


func contains_world_point(world_point: Vector2) -> bool:
	if locked or _polygon.is_empty():
		return false
	var local_point: Vector2 = to_local(world_point)
	if not _bounds.has_point(local_point):
		return false
	return Geometry2D.is_point_in_polygon(local_point, _polygon)


func begin_drag(world_point: Vector2) -> void:
	if locked:
		return
	_drag_offset = position - world_point
	_lifted = true
	z_index = 10000
	queue_redraw()


func drag_to(world_point: Vector2) -> void:
	if locked:
		return
	position = world_point + _drag_offset


func end_drag() -> bool:
	if locked:
		return false

	_lifted = false
	z_index = _base_z_index
	if position.distance_to(target_position) <= snap_distance:
		position = target_position
		locked = true
		queue_redraw()
		locked_in_place.emit(self)
		return true

	queue_redraw()
	return false


func _draw() -> void:
	if _polygon.is_empty() or _texture == null:
		return

	var shadow_alpha: float = 0.07 if locked else (0.24 if _lifted else 0.16)
	var shadow_screen_offset: Vector2 = Vector2(2.0, 2.5) if locked else (Vector2(12.0, 15.0) if _lifted else Vector2(5.0, 6.0))
	var shadow_local_offset: Vector2 = shadow_screen_offset / maxf(_display_scale, 0.001)
	var shadow_points := PackedVector2Array()
	shadow_points.resize(_polygon.size())
	for index in range(_polygon.size()):
		shadow_points[index] = _polygon[index] + shadow_local_offset

	draw_colored_polygon(shadow_points, Color(0.0, 0.0, 0.0, shadow_alpha))
	draw_colored_polygon(_polygon, Color(1.0, 1.0, 1.0, 1.0), _uv, _texture)

	if _detail_level <= 1:
		var dark_alpha: float = 0.30 if locked else 0.48
		var dark_width: float = (1.2 if _detail_level == 1 else 1.7) / maxf(_display_scale, 0.001)
		draw_polyline(_closed_outline, Color(0.015, 0.02, 0.03, dark_alpha), dark_width, true)

	if _detail_level == 0:
		var highlight_alpha: float = 0.18 if locked else 0.34
		var highlight_width: float = 0.65 / maxf(_display_scale, 0.001)
		draw_polyline(_closed_outline, Color(1.0, 1.0, 1.0, highlight_alpha), highlight_width, true)


func _calculate_bounds(points: PackedVector2Array) -> Rect2:
	if points.is_empty():
		return Rect2()

	var min_point: Vector2 = points[0]
	var max_point: Vector2 = points[0]
	for point in points:
		min_point.x = minf(min_point.x, point.x)
		min_point.y = minf(min_point.y, point.y)
		max_point.x = maxf(max_point.x, point.x)
		max_point.y = maxf(max_point.y, point.y)
	return Rect2(min_point, max_point - min_point)
